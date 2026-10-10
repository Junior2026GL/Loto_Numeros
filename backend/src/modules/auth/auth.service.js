import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import {
  findUserByUsername,
  findUserById,
  touchLastAccess,
  findPasswordHashById,
  updatePasswordById,
  findUserForReset,
  countRecentResetCodes,
  invalidatePendingResetCodes,
  createResetCode,
  findActiveResetCode,
  incrementResetCodeIntentos,
  markResetCodeUsed,
} from './auth.repository.js';
import { createLoginThrottle } from './login-throttle.js';
import { AppError } from '../../shared/errors/AppError.js';
import { assertValidPassword } from '../../shared/utils/password.js';
import { isMailConfigured, sendMail } from '../../infrastructure/mail/mailer.js';

const RESET_CODE_TTL_MINUTES = 10;
const RESET_MAX_INTENTOS = 5;
const RESET_COOLDOWN_MINUTES = 1;
const RESET_MAX_POR_HORA = 5;

const GENERIC_RESET_MESSAGE =
  'Si el usuario existe y tiene un correo registrado, se envió un código de verificación a ese correo.';

const loginSchema = z.object({
  usuario: z.string().trim().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const throttle = createLoginThrottle();

const throttleKey = (ip, usuario) => `${ip || 'sin-ip'}:${usuario.toLowerCase()}`;

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol, sv: user.version_sesion },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    usuario: user.usuario,
    rol: user.rol,
    debeCambiarPassword: Boolean(user.debe_cambiar_password),
  };
}

export async function login(payload, ip) {
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Datos inválidos', 400);
  }
  const { usuario, password } = parsed.data;

  const key = throttleKey(ip, usuario);
  const minutes = throttle.minutesLocked(key);
  if (minutes > 0) {
    throw new AppError(`Demasiados intentos fallidos. Intenta de nuevo en ${minutes} minuto(s).`, 429);
  }

  const user = await findUserByUsername(usuario);
  const valid = user?.activo && (await bcrypt.compare(password, user.password_hash));

  if (!valid) {
    throttle.registerFailure(key);
    throw new AppError('Usuario o contraseña incorrectos', 401);
  }

  throttle.clear(key);
  await touchLastAccess(user.id);

  return { token: signToken(user), user: publicUser(user) };
}

export async function me(userId) {
  const user = await findUserById(userId);
  if (!user) throw new AppError('Usuario no encontrado', 404);
  return publicUser(user);
}

/** Cambia la contraseña del propio usuario. Las demás sesiones caducan, así que devuelve un token nuevo. */
export async function changeMyPassword(userId, currentPassword, newPassword) {
  const account = await findPasswordHashById(userId);
  if (!account) throw new AppError('Usuario no encontrado', 404);

  const valid = await bcrypt.compare(currentPassword || '', account.password_hash);
  if (!valid) throw new AppError('La contraseña actual no es correcta', 400);

  assertValidPassword(newPassword, { usuario: account.usuario });
  if (newPassword === currentPassword) {
    throw new AppError('La nueva contraseña debe ser distinta de la actual');
  }

  await updatePasswordById(userId, await bcrypt.hash(newPassword, 12));

  const user = await findUserById(userId);
  return { token: signToken(user), user: publicUser(user) };
}

export function options() {
  // En desarrollo sin SMTP el código se escribe en la consola del servidor, para poder probar el flujo.
  return { recuperacionPorCorreo: isMailConfigured() || env.nodeEnv !== 'production' };
}

async function deliverResetCode(user, code) {
  const text =
    `Hola ${user.nombre},\n\n` +
    `Tu código para restablecer la contraseña de Loto Números es: ${code}\n\n` +
    `Vence en ${RESET_CODE_TTL_MINUTES} minutos. Si no lo solicitaste, ignora este mensaje.`;

  if (isMailConfigured()) {
    await sendMail({ to: user.email, subject: 'Código para restablecer tu contraseña', text });
  } else if (env.nodeEnv !== 'production') {
    console.log(`[recuperación] Código para ${user.usuario}: ${code} (SMTP no configurado)`);
  } else {
    throw new Error('El correo saliente no está configurado');
  }
}

export async function forgotPassword(usuario) {
  const generic = { ok: true, message: GENERIC_RESET_MESSAGE };

  const user = await findUserForReset(String(usuario || '').trim());
  // Nunca se revela si el usuario existe: todas las salidas devuelven el mismo mensaje.
  if (!user || !user.activo || !user.email) return generic;

  if ((await countRecentResetCodes(user.id, RESET_COOLDOWN_MINUTES)) > 0) return generic;
  if ((await countRecentResetCodes(user.id, 60)) >= RESET_MAX_POR_HORA) return generic;

  const code = String(randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

  await invalidatePendingResetCodes(user.id);
  await createResetCode({ usuarioId: user.id, codeHash, expiresAt });

  try {
    await deliverResetCode(user, code);
  } catch (error) {
    console.error(`No se pudo enviar el código de recuperación a ${user.usuario}:`, error.message);
  }

  return generic;
}

export async function resetPasswordWithCode({ usuario, code, newPassword }) {
  const invalidCodeError = new AppError('Código inválido o vencido', 400);

  const user = await findUserForReset(String(usuario || '').trim());
  if (!user || !user.activo) throw invalidCodeError;

  assertValidPassword(newPassword, { usuario: user.usuario });

  const record = await findActiveResetCode(user.id);
  if (!record) throw invalidCodeError;

  if (record.intentos >= RESET_MAX_INTENTOS) {
    throw new AppError('Se superó el número de intentos permitidos. Solicita un nuevo código.', 400);
  }

  if (!(await bcrypt.compare(String(code || ''), record.code_hash))) {
    await incrementResetCodeIntentos(record.id);
    throw invalidCodeError;
  }

  await updatePasswordById(user.id, await bcrypt.hash(newPassword, 12));
  await markResetCodeUsed(record.id);

  return { ok: true };
}

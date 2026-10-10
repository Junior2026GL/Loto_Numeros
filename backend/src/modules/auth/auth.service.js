import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env.js';
import {
  findUserByUsername,
  findUserById,
  touchLastAccess,
  findPasswordHashById,
  updatePasswordById,
} from './auth.repository.js';
import { AppError } from '../../shared/errors/AppError.js';

const LOGIN_MAX_INTENTOS = 5;
const LOGIN_BLOQUEO_MINUTOS = 15;

const loginSchema = z.object({
  usuario: z.string().trim().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

// Contador en memoria por IP+usuario. Se reinicia si el proceso se reinicia;
// suficiente para esta app interna, no requiere tabla ni dependencia externa.
const loginAttempts = new Map();

function loginAttemptKey(ip, usuario) {
  return `${ip || 'sin-ip'}:${usuario.toLowerCase()}`;
}

function assertNotLockedOut(key) {
  const entry = loginAttempts.get(key);
  if (!entry?.bloqueadoHasta || entry.bloqueadoHasta <= Date.now()) return;

  const minutosRestantes = Math.ceil((entry.bloqueadoHasta - Date.now()) / 60000);
  throw new AppError(
    `Demasiados intentos fallidos. Intenta de nuevo en ${minutosRestantes} minuto(s).`,
    429
  );
}

function registerFailedLoginAttempt(key) {
  const entry = loginAttempts.get(key) || { intentos: 0, bloqueadoHasta: null };
  entry.intentos += 1;

  if (entry.intentos >= LOGIN_MAX_INTENTOS) {
    entry.bloqueadoHasta = Date.now() + LOGIN_BLOQUEO_MINUTOS * 60 * 1000;
    entry.intentos = 0;
  }

  loginAttempts.set(key, entry);
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

export async function login(payload, ip) {
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Datos inválidos', 400);
  }
  const { usuario, password } = parsed.data;

  const key = loginAttemptKey(ip, usuario);
  assertNotLockedOut(key);

  const user = await findUserByUsername(usuario);

  if (!user || !user.activo) {
    registerFailedLoginAttempt(key);
    throw new AppError('Usuario o contraseña incorrectos', 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    registerFailedLoginAttempt(key);
    throw new AppError('Usuario o contraseña incorrectos', 401);
  }

  clearLoginAttempts(key);

  const token = jwt.sign(
    {
      sub: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      rol: user.rol,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  await touchLastAccess(user.id);

  return {
    token,
    user: {
      id: user.id,
      nombre: user.nombre,
      usuario: user.usuario,
      rol: user.rol,
    },
  };
}

export async function me(userId) {
  const user = await findUserById(userId);
  if (!user) throw new AppError('Usuario no encontrado', 404);

  return {
    id: user.id,
    nombre: user.nombre,
    usuario: user.usuario,
    rol: user.rol,
  };
}

export async function changeMyPassword(userId, currentPassword, newPassword) {
  const user = await findPasswordHashById(userId);
  if (!user) throw new AppError('Usuario no encontrado', 404);

  const valid = await bcrypt.compare(currentPassword || '', user.password_hash);
  if (!valid) throw new AppError('La contraseña actual no es correcta', 400);

  if (!newPassword || newPassword.length < 8) {
    throw new AppError('La nueva contraseña debe tener al menos 8 caracteres');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await updatePasswordById(userId, passwordHash);

  return { ok: true };
}


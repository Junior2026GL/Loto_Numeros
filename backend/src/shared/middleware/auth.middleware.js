import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { findUserById } from '../../modules/auth/auth.repository.js';

export async function authRequired(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Token requerido' });
  }

  let payload;
  try {
    payload = jwt.verify(header.substring(7), env.jwtSecret);
  } catch {
    return res.status(401).json({ ok: false, message: 'Token inválido o vencido' });
  }

  try {
    // El token solo identifica al usuario: su estado y su rol se leen siempre de la base de datos,
    // así un usuario desactivado o con otro rol pierde el acceso al instante y no al vencer el token.
    const user = await findUserById(payload.sub);
    // Los tokens sin versión (anteriores a esta medida) cuentan como versión 0.
    const sessionStillValid = user && (payload.sv ?? 0) === user.version_sesion;

    if (!user || !user.activo || !sessionStillValid) {
      return res.status(401).json({ ok: false, message: 'Sesión no válida. Inicia sesión de nuevo.' });
    }

    req.user = {
      ...payload,
      usuario: user.usuario,
      nombre: user.nombre,
      rol: user.rol,
      debeCambiarPassword: Boolean(user.debe_cambiar_password),
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

/** Bloquea el resto de la API mientras el usuario no haya cambiado su contraseña temporal. */
export function requirePasswordChanged(req, res, next) {
  if (req.user?.debeCambiarPassword) {
    return res.status(403).json({
      ok: false,
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Debes cambiar tu contraseña antes de continuar.',
    });
  }
  return next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ ok: false, message: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

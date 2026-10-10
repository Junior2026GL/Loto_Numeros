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
    if (!user || !user.activo) {
      return res.status(401).json({ ok: false, message: 'Sesión no válida. Inicia sesión de nuevo.' });
    }

    req.user = { ...payload, usuario: user.usuario, nombre: user.nombre, rol: user.rol };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ ok: false, message: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

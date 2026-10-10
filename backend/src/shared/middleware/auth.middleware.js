import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export function authRequired(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Token requerido' });
  }

  try {
    const token = header.substring(7);
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Token inválido o vencido' });
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

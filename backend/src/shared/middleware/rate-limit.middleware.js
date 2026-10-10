import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env.js';

const tooMany = (message) => (req, res) => {
  res.status(429).json({ ok: false, message });
};

/** Límite general de la API por IP: frena abusos y scripts descontrolados. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.rateLimit.api,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany('Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.'),
});

/**
 * Límite del login por IP. Solo cuentan los intentos fallidos, y se suma al bloqueo
 * por usuario que ya existe en el servicio de autenticación.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.rateLimit.login,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany('Demasiados intentos fallidos desde tu conexión. Intenta de nuevo en 15 minutos.'),
});

/** Recuperación de contraseña: pocas solicitudes por IP para no usarla como cañón de correos ni adivinar códigos. */
export const recoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.rateLimit.recovery,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany('Demasiadas solicitudes de recuperación. Intenta de nuevo en una hora.'),
});

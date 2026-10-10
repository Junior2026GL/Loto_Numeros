import { AppError } from '../errors/AppError.js';

/**
 * Política de contraseñas: mínimo 8 caracteres, con al menos una letra y un número,
 * y distinta del nombre de usuario. Lanza AppError con el motivo.
 */
export function assertValidPassword(password, { usuario } = {}) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new AppError('La contraseña debe tener al menos 8 caracteres');
  }
  if (password.length > 128) {
    throw new AppError('La contraseña no puede superar los 128 caracteres');
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new AppError('La contraseña debe incluir al menos una letra y un número');
  }
  if (usuario && password.toLowerCase() === String(usuario).toLowerCase()) {
    throw new AppError('La contraseña no puede ser igual al nombre de usuario');
  }
}

import * as authService from './auth.service.js';
import { record as recordAudit } from '../audit/audit.service.js';

export async function login(req, res, next) {
  try {
    const data = await authService.login(req.body, req.ip);
    await recordAudit(req, {
      userId: data.user.id,
      accion: 'LOGIN',
      modulo: 'AUTENTICACION',
      descripcion: `Inicio de sesión (${data.user.usuario})`,
    });
    res.json({ ok: true, data });
  } catch (error) {
    if (error.statusCode === 401) {
      await recordAudit(req, {
        accion: 'LOGIN_FALLIDO',
        modulo: 'AUTENTICACION',
        descripcion: `Intento fallido de inicio de sesión (${req.body?.usuario || 'usuario desconocido'})`,
      });
    }
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const data = await authService.me(req.user.sub);
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export function options(req, res) {
  res.json({ ok: true, data: authService.options() });
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const data = await authService.changeMyPassword(req.user.sub, currentPassword, newPassword);
    await recordAudit(req, {
      accion: 'CAMBIO_PASSWORD',
      modulo: 'AUTENTICACION',
      descripcion: 'Cambio de contraseña propia',
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const data = await authService.forgotPassword(req.body?.usuario);
    await recordAudit(req, {
      accion: 'SOLICITUD_RESET_PASSWORD',
      modulo: 'AUTENTICACION',
      descripcion: `Solicitud de código de recuperación (${req.body?.usuario || 'usuario desconocido'})`,
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { usuario, code, newPassword } = req.body || {};
    const data = await authService.resetPasswordWithCode({ usuario, code, newPassword });
    await recordAudit(req, {
      accion: 'RESET_PASSWORD_CORREO',
      modulo: 'AUTENTICACION',
      descripcion: `Contraseña restablecida con código de recuperación (${usuario})`,
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

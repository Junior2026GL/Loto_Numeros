import * as service from './users.service.js';
import { record as recordAudit } from '../audit/audit.service.js';

export async function list(req, res, next) {
  try {
    res.json({ ok: true, data: await service.list() });
  } catch (error) {
    next(error);
  }
}

export async function roles(req, res, next) {
  try {
    res.json({ ok: true, data: await service.roles() });
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    res.json({ ok: true, data: await service.getById(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = await service.create(req.body);
    await recordAudit(req, {
      accion: 'CREAR',
      modulo: 'USUARIOS',
      descripcion: `Usuario creado: ${data.usuario} (${data.rol})`,
    });
    res.status(201).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const data = await service.update(req.params.id, req.body);
    await recordAudit(req, {
      accion: 'ACTUALIZAR',
      modulo: 'USUARIOS',
      descripcion: `Usuario actualizado: ${data.usuario}`,
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const data = await service.resetPassword(req.params.id, req.body.password);
    await recordAudit(req, {
      accion: 'RESET_PASSWORD',
      modulo: 'USUARIOS',
      descripcion: `Contraseña restablecida para el usuario #${req.params.id}`,
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function setActive(req, res, next) {
  try {
    const data = await service.setActive(req.params.id, !!req.body.activo, req.user.sub);
    await recordAudit(req, {
      accion: data.activo ? 'ACTIVAR' : 'DESACTIVAR',
      modulo: 'USUARIOS',
      descripcion: `Usuario ${data.activo ? 'activado' : 'desactivado'}: ${data.usuario}`,
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

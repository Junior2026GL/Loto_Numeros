import * as service from './draws.service.js';
import { record as recordAudit } from '../audit/audit.service.js';

function formatNumbers(draw) {
  return draw.numeros.map((n) => String(n).padStart(2, '0')).join('-');
}

export async function game(req, res, next) {
  try {
    res.json({ ok: true, data: await service.game() });
  } catch (error) {
    next(error);
  }
}

export async function summary(req, res, next) {
  try {
    res.json({ ok: true, data: await service.summary() });
  } catch (error) {
    next(error);
  }
}

export async function months(req, res, next) {
  try {
    res.json({ ok: true, data: await service.months() });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    res.json({ ok: true, data: await service.list(req.query) });
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
    const data = await service.create(req.body, req.user.sub);
    await recordAudit(req, {
      accion: 'CREAR',
      modulo: 'SORTEOS',
      descripcion: `Sorteo registrado: ${data.fecha} (${formatNumbers(data)})`,
    });
    res.status(201).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const data = await service.remove(req.params.id);
    await recordAudit(req, {
      accion: 'ELIMINAR',
      modulo: 'SORTEOS',
      descripcion: `Sorteo eliminado: ${data.fecha} (${formatNumbers(data)})`,
    });
    res.json({ ok: true, data: { id: data.id } });
  } catch (error) {
    next(error);
  }
}

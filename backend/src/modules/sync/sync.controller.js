import * as service from './sync.service.js';
import { record as recordAudit } from '../audit/audit.service.js';

export async function status(req, res, next) {
  try {
    res.json({ ok: true, data: await service.status() });
  } catch (error) {
    next(error);
  }
}

export async function history(req, res, next) {
  try {
    res.json({ ok: true, data: await service.history(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function run(req, res, next) {
  try {
    const { desde, hasta } = req.body || {};
    const data = await service.run({ desde, hasta, usuarioId: req.user.sub, origen: 'MANUAL' });
    await recordAudit(req, {
      accion: 'SINCRONIZAR',
      modulo: 'SORTEOS',
      descripcion: `Sincronización con loto.hn (${desde} a ${hasta}): ${data.insertados} nuevo(s), ${data.errores} error(es)`,
    });
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

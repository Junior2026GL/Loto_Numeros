import * as service from './audit.service.js';

export async function stats(req, res, next) {
  try {
    const data = await service.stats(req.query);
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const data = await service.list(req.query);
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}

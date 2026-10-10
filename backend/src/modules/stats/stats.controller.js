import * as service from './stats.service.js';

export async function getStats(req, res, next) {
  try {
    res.json({ ok: true, data: await service.getStats(req.query) });
  } catch (error) {
    next(error);
  }
}

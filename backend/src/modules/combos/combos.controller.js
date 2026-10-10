import * as service from './combos.service.js';
import { sendCsv } from '../../shared/utils/csv.js';

const handler = (fn) => async (req, res, next) => {
  try {
    const { status = 200, data } = await fn(req);
    res.status(status).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
};

export const generate = handler(async () => ({ data: await service.generate() }));
export const list = handler(async (req) => ({ data: await service.list(req.query, req.user.sub) }));
export const summary = handler(async (req) => ({ data: await service.summary(req.user.sub) }));
export const retrospective = handler(async (req) => ({ data: await service.retrospective(req.query) }));
export const save = handler(async (req) => ({ status: 201, data: await service.save(req.body, req.user.sub) }));
export const setPlayed = handler(async (req) => ({
  data: await service.setPlayed(req.params.id, req.body?.jugada, req.user.sub),
}));
export const remove = handler(async (req) => {
  await service.remove(req.params.id, req.user.sub);
  return { data: { id: Number(req.params.id) } };
});

export async function exportCsv(req, res, next) {
  try {
    sendCsv(res, 'mis-combinaciones.csv', await service.exportCsv(req.user.sub));
  } catch (error) {
    next(error);
  }
}

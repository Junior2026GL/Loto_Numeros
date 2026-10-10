import { z } from 'zod';
import { AppError } from '../../shared/errors/AppError.js';
import { DATE_REGEX, todayInHonduras, weekdayOf } from '../../shared/utils/dates.js';
import * as draws from '../draws/draws.repository.js';
import { upcomingDraw } from '../draws/draws.service.js';
import { getStats } from '../stats/stats.service.js';
import * as repository from './combos.repository.js';
import { STRATEGIES, STRATEGY_CODES, countHits, generateAll } from './combos.generator.js';

const strategyName = (codigo) => STRATEGIES.find((s) => s.codigo === codigo)?.nombre || codigo;

const saveSchema = z.object({
  estrategia: z.enum(STRATEGY_CODES, { errorMap: () => ({ message: 'Estrategia inválida' }) }),
  numeros: z.array(z.coerce.number().int('Los números deben ser enteros'), {
    errorMap: () => ({ message: 'Debes enviar la lista de números' }),
  }),
  fecha: z.string().regex(DATE_REGEX, 'La fecha debe tener formato AAAA-MM-DD').optional(),
});

async function getGame() {
  const game = await draws.findDefaultGame();
  if (!game) throw new AppError('No hay un juego activo configurado', 500);
  return { ...game, dias: game.dias_sorteo.split(',').map(Number) };
}

/** Calcula los aciertos de las combinaciones cuyo sorteo ya se conoce. */
async function evaluatePending(usuarioId, juegoId) {
  const pending = await repository.findPendingEvaluation(usuarioId, juegoId);
  if (!pending.length) return;

  const results = await repository.loadResultsBySorteoIds([...new Set(pending.map((p) => p.sorteo_id))]);
  for (const combo of pending) {
    const result = results.get(combo.sorteo_id);
    if (result?.length) await repository.markEvaluated(combo.id, countHits(combo.numeros, result));
  }
}

export async function generate() {
  const game = await getGame();
  const stats = await getStats({});
  return {
    estrategias: generateAll(stats, game),
    proximoSorteo: await upcomingDraw(),
    sorteosAnalizados: stats.totalSorteos,
  };
}

export async function save(payload, usuarioId) {
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Datos inválidos');
  const data = parsed.data;
  const game = await getGame();

  if (data.numeros.length !== game.cantidad_numeros) {
    throw new AppError(`La combinación debe tener ${game.cantidad_numeros} números`);
  }
  if (data.numeros.some((n) => n < game.numero_min || n > game.numero_max)) {
    throw new AppError(`Los números deben estar entre ${game.numero_min} y ${game.numero_max}`);
  }
  if (new Set(data.numeros).size !== data.numeros.length) throw new AppError('Los números no pueden repetirse');

  const fecha = data.fecha || (await upcomingDraw()).fecha;
  const dia = weekdayOf(fecha);
  if (dia === null || !game.dias.includes(dia)) throw new AppError('La fecha no corresponde a un día de sorteo');
  if (fecha < todayInHonduras()) throw new AppError('Ese sorteo ya pasó');
  if (await draws.findDrawByDate(game.id, fecha)) throw new AppError('Ese sorteo ya tiene resultado publicado');

  const id = await repository.insertCombination({
    usuarioId,
    juegoId: game.id,
    estrategia: data.estrategia,
    numeros: [...data.numeros].sort((a, b) => a - b),
    fechaObjetivo: fecha,
  });
  return repository.findOwned(id, usuarioId);
}

export async function list(query, usuarioId) {
  const game = await getGame();
  await evaluatePending(usuarioId, game.id);

  const result = await repository.listCombinations({
    usuarioId,
    juegoId: game.id,
    page: query.page,
    pageSize: query.pageSize,
  });

  // Se adjunta el resultado real a las ya evaluadas para poder resaltar los aciertos.
  const fechas = [...new Set(result.items.filter((c) => c.evaluada_at).map((c) => c.fecha_sorteo_objetivo))];
  const results = await repository.loadResults(game.id, fechas);

  return {
    total: result.total,
    items: result.items.map((c) => ({
      ...c,
      estrategia_nombre: strategyName(c.estrategia),
      resultado: c.evaluada_at ? results.get(c.fecha_sorteo_objetivo) || null : null,
    })),
  };
}

export async function summary(usuarioId) {
  const game = await getGame();
  await evaluatePending(usuarioId, game.id);

  return {
    // Aciertos promedio esperados por puro azar: cada número jugado acierta con prob. 6/33.
    promedioPorAzar: Math.round(((game.cantidad_numeros * game.cantidad_numeros) / (game.numero_max - game.numero_min + 1)) * 100) / 100,
    estrategias: (await repository.performanceByStrategy(usuarioId, game.id)).map((e) => ({
      ...e,
      nombre: strategyName(e.estrategia),
    })),
  };
}

export async function setPlayed(id, jugada, usuarioId) {
  if (!(await repository.findOwned(id, usuarioId))) throw new AppError('Combinación no encontrada', 404);
  await repository.setPlayed(id, usuarioId, Boolean(jugada));
  return repository.findOwned(id, usuarioId);
}

export async function remove(id, usuarioId) {
  if (!(await repository.findOwned(id, usuarioId))) throw new AppError('Combinación no encontrada', 404);
  await repository.deleteOwned(id, usuarioId);
}

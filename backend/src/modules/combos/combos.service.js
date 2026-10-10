import { z } from 'zod';
import { AppError } from '../../shared/errors/AppError.js';
import { DATE_REGEX, todayInHonduras, weekdayOf } from '../../shared/utils/dates.js';
import * as draws from '../draws/draws.repository.js';
import { upcomingDraw } from '../draws/draws.service.js';
import { getStats } from '../stats/stats.service.js';
import * as statsRepository from '../stats/stats.repository.js';
import * as repository from './combos.repository.js';
import { backtest } from './combos.backtest.js';
import { toCsv } from '../../shared/utils/csv.js';
import { STRATEGIES, STRATEGY_CODES, countHits, generateBatch } from './combos.generator.js';
import { prizeOdds } from './combos.odds.js';
import { buildWheel } from './combos.wheel.js';
import { simulateCombination } from './combos.simulate.js';

const strategyName = (codigo) => (codigo === 'MANUAL' ? 'Manual' : STRATEGIES.find((s) => s.codigo === codigo)?.nombre || codigo);

const saveSchema = z.object({
  estrategia: z.enum([...STRATEGY_CODES, 'MANUAL'], { errorMap: () => ({ message: 'Estrategia inválida' }) }),
  numeros: z.array(z.coerce.number().int('Los números deben ser enteros'), {
    errorMap: () => ({ message: 'Debes enviar la lista de números' }),
  }),
  fecha: z.string().regex(DATE_REGEX, 'La fecha debe tener formato AAAA-MM-DD').optional(),
});

const MAX_MONEY = 100_000_000;
const round2 = (value) => Math.round(value * 100) / 100;

async function getGame() {
  const game = await draws.findDefaultGame();
  if (!game) throw new AppError('No hay un juego activo configurado', 500);
  return { ...game, dias: game.dias_sorteo.split(',').map(Number) };
}

async function getTicketPrice() {
  const value = Number((await statsRepository.loadConfig()).precio_boleto);
  return Number.isFinite(value) && value >= 0 ? value : 20;
}

/** Valida una lista de números contra el rango del juego: enteros, sin repetir y dentro del rango. */
function parseNumbers(list, game, label) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw new AppError(`${label}: debes enviar una lista de números`);
  const numbers = list.map(Number);
  if (numbers.some((n) => !Number.isInteger(n))) throw new AppError(`${label}: todos deben ser números enteros`);
  if (numbers.some((n) => n < game.numero_min || n > game.numero_max)) {
    throw new AppError(`${label}: deben estar entre ${game.numero_min} y ${game.numero_max}`);
  }
  if (new Set(numbers).size !== numbers.length) throw new AppError(`${label}: no pueden repetirse`);
  return numbers;
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

export async function generate(body = {}) {
  const game = await getGame();

  const fijos = parseNumbers(body.fijos, game, 'Números fijos');
  const excluidos = parseNumbers(body.excluidos, game, 'Números excluidos');
  const poolSize = game.numero_max - game.numero_min + 1;

  if (fijos.length > game.cantidad_numeros - 1) {
    throw new AppError(`Puedes fijar como máximo ${game.cantidad_numeros - 1} números`);
  }
  if (fijos.some((n) => excluidos.includes(n))) throw new AppError('Un número no puede ser fijo y excluido a la vez');
  if (poolSize - excluidos.length < game.cantidad_numeros) {
    throw new AppError(`Excluiste demasiados números: deben quedar al menos ${game.cantidad_numeros} disponibles`);
  }

  const cantidad = Number(body.cantidad ?? 1);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 10) throw new AppError('La cantidad debe estar entre 1 y 10');

  const equilibrada = Boolean(body.equilibrada);
  const stats = await getStats({});
  const { estrategias, sinEquilibrio } = generateBatch(stats, game, undefined, { fijos, excluidos, equilibrada, cantidad });

  const advertencias = [];
  if (equilibrada && sinEquilibrio > 0) {
    advertencias.push('Con los números fijos que elegiste no siempre se puede lograr una combinación equilibrada.');
  }

  return {
    estrategias,
    proximoSorteo: await upcomingDraw(),
    sorteosAnalizados: stats.totalSorteos,
    opciones: { fijos, excluidos, equilibrada, cantidad },
    advertencias,
  };
}

/** Probabilidades de cada premio y precio de un boleto. */
export async function odds() {
  const game = await getGame();
  return { ...prizeOdds(game), precioBoleto: await getTicketPrice() };
}

/** Arma un sistema de cobertura a partir de un grupo de números. */
export async function wheel(body = {}) {
  const game = await getGame();
  const grupo = parseNumbers(body.grupo, game, 'Grupo');
  const garantia = Number(body.garantia);
  if (!Number.isInteger(garantia)) throw new AppError('Indica cuántos aciertos quieres garantizar');

  let result;
  try {
    result = buildWheel(grupo, game, garantia);
  } catch (error) {
    throw new AppError(error.message);
  }

  const precio = await getTicketPrice();
  return { ...result, precioBoleto: precio, costoTotal: round2(result.totalBoletos * precio) };
}

/** ¿Cómo le habría ido a una combinación en los últimos sorteos? */
export async function simulate(body = {}) {
  const game = await getGame();
  const numeros = parseNumbers(body.numeros, game, 'La combinación');
  if (numeros.length !== game.cantidad_numeros) throw new AppError(`La combinación debe tener ${game.cantidad_numeros} números`);

  const requested = Number(body.ultimos);
  const ultimos = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 1000) : null;
  const history = await statsRepository.loadDraws({ juegoId: game.id, ultimos });

  const expected = Math.round(((game.cantidad_numeros * game.cantidad_numeros) / (game.numero_max - game.numero_min + 1)) * 1000) / 1000;
  return simulateCombination(numeros, history, expected);
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

/** Primer día del mes de una fecha AAAA-MM-DD y primer día del mes siguiente. */
function monthBounds(fecha) {
  const [year, month] = fecha.split('-').map(Number);
  const next = month === 12 ? [year + 1, 1] : [year, month + 1];
  const pad = (n) => String(n).padStart(2, '0');
  return { desde: `${year}-${pad(month)}-01`, hasta: `${next[0]}-${pad(next[1])}-01` };
}

/** Resumen de lo gastado y ganado: este mes y en total. */
export async function budget(usuarioId) {
  const game = await getGame();
  const [precioBoleto, limiteMensual] = await Promise.all([getTicketPrice(), repository.getMonthlyLimit(usuarioId)]);
  const [mes, total] = await Promise.all([
    repository.spending(usuarioId, game.id, monthBounds(todayInHonduras())),
    repository.spending(usuarioId, game.id),
  ]);

  const withBalance = (s) => ({ ...s, gastado: round2(s.gastado), ganado: round2(s.ganado), saldo: round2(s.ganado - s.gastado) });
  return {
    precioBoleto,
    limiteMensual,
    mes: { ...withBalance(mes), restante: limiteMensual === null ? null : round2(limiteMensual - mes.gastado) },
    total: withBalance(total),
  };
}

export async function setLimit(usuarioId, value) {
  let limite = null;
  if (value !== null && value !== undefined && value !== '') {
    limite = Number(value);
    if (!Number.isFinite(limite) || limite < 0 || limite > MAX_MONEY) throw new AppError('El límite debe ser un monto válido');
    limite = round2(limite);
  }
  await repository.setMonthlyLimit(usuarioId, limite);
  return budget(usuarioId);
}

export async function setPlayed(id, jugada, usuarioId, confirmar = false) {
  const combo = await repository.findOwned(id, usuarioId);
  if (!combo) throw new AppError('Combinación no encontrada', 404);

  const play = Boolean(jugada);
  if (!play) {
    await repository.setPlayed(id, usuarioId, false);
    return repository.findOwned(id, usuarioId);
  }
  if (combo.jugada) return combo; // ya estaba jugada: no se vuelve a cobrar

  const game = await getGame();
  const precio = await getTicketPrice();
  const limite = await repository.getMonthlyLimit(usuarioId);

  // Límite mensual (responsabilidad al jugar): se avisa antes de pasarse y hay que confirmar.
  if (limite !== null && !confirmar) {
    const mes = await repository.spending(usuarioId, game.id, monthBounds(combo.fecha_sorteo_objetivo || todayInHonduras()));
    if (mes.gastado + precio > limite) {
      throw new AppError('Con esta combinación superarías tu límite mensual de gasto.', 409, {
        code: 'LIMIT_EXCEEDED',
        gastado: round2(mes.gastado),
        limite,
        costo: precio,
      });
    }
  }

  await repository.setPlayed(id, usuarioId, true, precio);
  return repository.findOwned(id, usuarioId);
}

export async function setPrize(id, premio, usuarioId) {
  const combo = await repository.findOwned(id, usuarioId);
  if (!combo) throw new AppError('Combinación no encontrada', 404);
  if (!combo.jugada) throw new AppError('Marca primero la combinación como jugada para registrar un premio');

  let value = null;
  if (premio !== null && premio !== undefined && premio !== '') {
    value = Number(premio);
    if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY) throw new AppError('El premio debe ser un monto válido');
    value = round2(value);
  }
  await repository.setPrize(id, usuarioId, value);
  return repository.findOwned(id, usuarioId);
}

export async function remove(id, usuarioId) {
  if (!(await repository.findOwned(id, usuarioId))) throw new AppError('Combinación no encontrada', 404);
  await repository.deleteOwned(id, usuarioId);
}

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Mide cada estrategia contra sorteos pasados usando solo la información previa a cada sorteo. */
export async function retrospective(query) {
  const game = await getGame();
  const [history, config] = await Promise.all([
    statsRepository.loadDraws({ juegoId: game.id }),
    statsRepository.loadConfig(),
  ]);

  return backtest(
    history,
    game,
    {
      ventanaCalientes: config.ventana_calientes,
      pesos: { frecuencia: config.peso_frecuencia, atraso: config.peso_atraso, caliente: config.peso_caliente },
    },
    {
      combinaciones: clamp(query.combinaciones, 10, 200, 50),
      minimo: clamp(query.minimo, 10, 200, 20),
    }
  );
}

/** Todas las combinaciones del usuario en CSV (con aciertos, resultado, costo y premio). */
export async function exportCsv(usuarioId) {
  const game = await getGame();
  await evaluatePending(usuarioId, game.id);

  const { items } = await repository.listCombinations({ usuarioId, juegoId: game.id, page: 1, pageSize: 100_000, maxPageSize: 100_000 });
  const results = await repository.loadResults(game.id, [...new Set(items.filter((c) => c.evaluada_at).map((c) => c.fecha_sorteo_objetivo))]);
  const join = (numbers) => (numbers ? numbers.join('-') : '');

  return toCsv(items, [
    { header: 'Creada', value: (c) => String(c.created_at).slice(0, 16) },
    { header: 'Estrategia', value: (c) => strategyName(c.estrategia) },
    { header: 'Números', value: (c) => join(c.numeros) },
    { header: 'Sorteo', value: (c) => c.fecha_sorteo_objetivo },
    { header: 'Resultado', value: (c) => join(results.get(c.fecha_sorteo_objetivo)) },
    { header: 'Aciertos', value: (c) => c.aciertos },
    { header: 'Jugada', value: (c) => (c.jugada ? 'Sí' : 'No') },
    { header: 'Costo', value: (c) => c.costo },
    { header: 'Premio', value: (c) => c.premio },
  ]);
}

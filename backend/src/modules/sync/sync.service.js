import { AppError } from '../../shared/errors/AppError.js';
import {
  DATE_REGEX,
  addDays,
  diffDays,
  drawDatesBetween,
  todayInHonduras,
  weekdayOf,
} from '../../shared/utils/dates.js';
import { fetchDrawResult } from '../../infrastructure/lotto/lotohn.client.js';
import * as draws from '../draws/draws.repository.js';
import { FIRST_DRAW_DATE, isPublished, missingDraws } from '../draws/draws.service.js';
import * as repository from './sync.repository.js';
import { env } from '../../config/env.js';

const MAX_RANGE_DAYS = 400;
const REQUEST_DELAY_MS = 200;
const MAX_CONSECUTIVE_ERRORS = 5;

let running = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getGame() {
  const game = await draws.findDefaultGame();
  if (!game) throw new AppError('No hay un juego activo configurado', 500);
  return { ...game, dias: game.dias_sorteo.split(',').map(Number) };
}

function validateRange(desde, hasta) {
  if (weekdayOf(desde) === null || weekdayOf(hasta) === null) {
    throw new AppError('Las fechas deben ser válidas y tener formato AAAA-MM-DD');
  }
  if (desde > hasta) throw new AppError('La fecha "desde" no puede ser posterior a "hasta"');
  if (diffDays(desde, hasta) > MAX_RANGE_DAYS) {
    throw new AppError(`El rango no puede superar ${MAX_RANGE_DAYS} días`);
  }
}

function checkNumbers(numeros, game) {
  if (numeros.length !== game.cantidad_numeros || numeros.some((n) => !Number.isInteger(n))) {
    return 'Cantidad de números inválida';
  }
  if (numeros.some((n) => n < game.numero_min || n > game.numero_max)) {
    return `Número fuera del rango ${game.numero_min}-${game.numero_max}`;
  }
  if (new Set(numeros).size !== numeros.length) return 'Números repetidos';
  return null;
}

export async function run({ desde, hasta, usuarioId = null, origen = 'MANUAL' }) {
  if (!DATE_REGEX.test(desde || '') || !DATE_REGEX.test(hasta || '')) {
    throw new AppError('Las fechas deben tener formato AAAA-MM-DD');
  }
  const limite = todayInHonduras();
  const hastaEfectivo = hasta > limite ? limite : hasta;
  validateRange(desde, hastaEfectivo);

  if (running) throw new AppError('Ya hay una sincronización en curso. Espera a que termine.', 409);
  running = true;

  let runId = null;
  try {
    const game = await getGame();
    const fechas = drawDatesBetween(desde, hastaEfectivo, game.dias);
    const existentes = new Set(await draws.listDrawDates(game.id, desde, hastaEfectivo));
    const pendientes = fechas.filter((f) => !existentes.has(f) && isPublished(f, game));

    runId = await repository.createRun({
      juegoId: game.id,
      usuarioId,
      origen,
      desde,
      hasta: hastaEfectivo,
      totalFechas: fechas.length,
    });

    let insertados = 0;
    let omitidos = existentes.size;
    let errores = 0;
    let erroresSeguidos = 0;
    let abortada = false;
    const detalle = [];

    for (const fecha of pendientes) {
      try {
        const result = await fetchDrawResult(fecha, game.cantidad_numeros);
        erroresSeguidos = 0;

        if (!result) {
          omitidos += 1;
          detalle.push(`${fecha}: sin resultado publicado`);
        } else {
          const problema = checkNumbers(result.numeros, game);
          if (problema) {
            errores += 1;
            detalle.push(`${fecha}: ${problema}`);
          } else {
            await draws.createDraw({
              juegoId: game.id,
              fecha,
              numeros: [...result.numeros].sort((a, b) => a - b),
              fuente: 'SCRAPER',
              creadoPor: usuarioId,
            });
            insertados += 1;
          }
        }
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          omitidos += 1; // otro proceso lo guardó mientras tanto
        } else {
          errores += 1;
          erroresSeguidos += 1;
          detalle.push(`${fecha}: ${error.message}`);
          if (erroresSeguidos >= MAX_CONSECUTIVE_ERRORS) {
            abortada = true;
            detalle.push('Se detuvo: la fuente no responde.');
            break;
          }
        }
      }
      await sleep(REQUEST_DELAY_MS);
    }

    // La tarea programada no deja rastro cuando simplemente no había nada nuevo.
    if (origen === 'PROGRAMADA' && insertados === 0 && errores === 0) {
      await repository.deleteRun(runId);
      return { id: null, estado: 'COMPLETADA', totalFechas: fechas.length, insertados, omitidos, errores, detalle };
    }

    const estado = abortada || (errores > 0 && insertados === 0 && pendientes.length > 0) ? 'FALLIDA' : 'COMPLETADA';
    await repository.finishRun(runId, { insertados, omitidos, errores, estado, detalle: detalle.join('\n') });

    return { id: runId, estado, totalFechas: fechas.length, insertados, omitidos, errores, detalle };
  } catch (error) {
    if (runId) {
      await repository
        .finishRun(runId, { insertados: 0, omitidos: 0, errores: 1, estado: 'FALLIDA', detalle: error.message })
        .catch(() => {});
    }
    throw error;
  } finally {
    running = false;
  }
}

/** Busca todo lo que falta desde el último sorteo guardado hasta hoy. */
export async function runPending({ usuarioId = null, origen = 'MANUAL' } = {}) {
  const game = await getGame();
  const last = await draws.findLastDrawDate(game.id);
  return run({
    desde: last ? addDays(last, 1) : FIRST_DRAW_DATE,
    hasta: todayInHonduras(),
    usuarioId,
    origen,
  });
}

export async function status() {
  const [missing, lastRun] = await Promise.all([missingDraws(), repository.lastRun(await getGameId())]);
  const hoy = missing.hasta;

  return {
    ultimoSorteo: missing.ultimoSorteo,
    sugerido: { desde: missing.desde > hoy ? hoy : missing.desde, hasta: hoy },
    pendientes: missing.pendientes,
    ultimaEjecucion: lastRun,
    autoSync: env.lotto.autoSync,
    ejecutando: running,
  };
}

async function getGameId() {
  return (await getGame()).id;
}

export async function history(query) {
  const game = await getGame();
  return repository.listRuns({ juegoId: game.id, page: query.page, pageSize: query.pageSize });
}

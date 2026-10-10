import { z } from 'zod';
import { AppError } from '../../shared/errors/AppError.js';
import { DATE_REGEX, addDays, drawDatesBetween, nowInHonduras, todayInHonduras, weekdayOf } from '../../shared/utils/dates.js';
import { toCsv } from '../../shared/utils/csv.js';
import * as repository from './draws.repository.js';

// Minutos después de la hora del sorteo en que ya se espera que el resultado esté publicado.
const PUBLISH_GRACE_MINUTES = 15;
// Primera fecha con resultados en la fuente (loto.hn no tiene sorteos anteriores).
export const FIRST_DRAW_DATE = '2026-01-01';

const createSchema = z.object({
  fecha: z.string().regex(DATE_REGEX, 'La fecha debe tener formato AAAA-MM-DD'),
  numeros: z.array(z.coerce.number().int('Los números deben ser enteros'), {
    errorMap: () => ({ message: 'Debes enviar la lista de números' }),
  }),
});

function validate(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message || 'Datos inválidos', 400);
  }
  return result.data;
}

async function getGame() {
  const game = await repository.findDefaultGame();
  if (!game) throw new AppError('No hay un juego activo configurado', 500);
  return { ...game, dias: game.dias_sorteo.split(',').map(Number) };
}

/** Próximo sorteo (fecha, día y hora) según los días del juego y la hora actual de Honduras. */
function nextDraw(game) {
  const now = nowInHonduras();
  const [hh, mm] = game.hora_sorteo.split(':').map(Number);
  const minutesNow = now.getUTCHours() * 60 + now.getUTCMinutes();

  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(now.getTime() + offset * 86400000);
    if (!game.dias.includes(day.getUTCDay())) continue;
    if (offset === 0 && minutesNow >= hh * 60 + mm) continue;
    return {
      fecha: day.toISOString().slice(0, 10),
      dia_semana: day.getUTCDay(),
      hora: game.hora_sorteo.slice(0, 5),
    };
  }
  return null;
}

export async function upcomingDraw() {
  return nextDraw(await getGame());
}

/** Hoy aún no cuenta como pendiente si el resultado todavía no se espera publicado. */
export function isPublished(fecha, game) {
  if (fecha !== todayInHonduras()) return true;
  const [hh, mm] = game.hora_sorteo.split(':').map(Number);
  const now = nowInHonduras();
  return now.getUTCHours() * 60 + now.getUTCMinutes() >= hh * 60 + mm + PUBLISH_GRACE_MINUTES;
}

/** Sorteos que ya deberían existir pero no están guardados (desde el último guardado hasta hoy). */
export async function missingDraws() {
  const g = await getGame();
  const last = await repository.findLastDrawDate(g.id);
  const hoy = todayInHonduras();
  const desde = last ? addDays(last, 1) : FIRST_DRAW_DATE;
  const fechas = desde > hoy ? [] : drawDatesBetween(desde, hoy, g.dias).filter((f) => isPublished(f, g));
  return { ultimoSorteo: last, pendientes: fechas.length, desde, hasta: hoy };
}

export async function game() {
  const { dias, ...rest } = await getGame();
  return { ...rest, dias_sorteo: dias };
}

export async function list(query) {
  const g = await getGame();
  const dia = query.dia === undefined || query.dia === '' ? null : Number(query.dia);

  return repository.listDraws({
    juegoId: g.id,
    mes: Number(query.mes) || null,
    anio: Number(query.anio) || null,
    dia: Number.isInteger(dia) && g.dias.includes(dia) ? dia : null,
    page: query.page,
    pageSize: query.pageSize,
  });
}

export async function months() {
  const g = await getGame();
  return repository.listAvailableMonths(g.id);
}

export async function summary() {
  const g = await getGame();
  const [ultimo, total, masFrecuente, faltantes] = await Promise.all([
    repository.findLastDraw(g.id),
    repository.countDraws(g.id),
    repository.findMostFrequent(g.id),
    missingDraws(),
  ]);

  return {
    juego: { nombre: g.nombre, cantidad_numeros: g.cantidad_numeros, numero_min: g.numero_min, numero_max: g.numero_max },
    ultimo,
    total,
    masFrecuente,
    pendientes: faltantes.pendientes,
    proximo: nextDraw(g),
  };
}

export async function getById(id) {
  const draw = await repository.findDrawById(id);
  if (!draw) throw new AppError('Sorteo no encontrado', 404);
  return draw;
}

export async function create(payload, userId) {
  const data = validate(createSchema, payload);
  const g = await getGame();

  const dia = weekdayOf(data.fecha);
  if (dia === null) throw new AppError('La fecha no es válida');
  if (!g.dias.includes(dia)) {
    throw new AppError('La fecha no corresponde a un día de sorteo de este juego');
  }
  if (data.fecha > todayInHonduras()) {
    throw new AppError('No se puede registrar un sorteo con fecha futura');
  }

  if (data.numeros.length !== g.cantidad_numeros) {
    throw new AppError(`Debes ingresar exactamente ${g.cantidad_numeros} números`);
  }
  if (data.numeros.some((n) => n < g.numero_min || n > g.numero_max)) {
    throw new AppError(`Los números deben estar entre ${g.numero_min} y ${g.numero_max}`);
  }
  if (new Set(data.numeros).size !== data.numeros.length) {
    throw new AppError('Los números no pueden repetirse');
  }

  if (await repository.findDrawByDate(g.id, data.fecha)) {
    throw new AppError('Ya existe un sorteo registrado en esa fecha', 409);
  }

  const id = await repository.createDraw({
    juegoId: g.id,
    fecha: data.fecha,
    numeros: [...data.numeros].sort((a, b) => a - b),
    fuente: 'MANUAL',
    creadoPor: userId,
  });

  return getById(id);
}

export async function remove(id) {
  const draw = await getById(id);
  await repository.deleteDraw(id);
  return draw;
}

/** Historial de sorteos en CSV, respetando los mismos filtros de la pantalla. */
export async function exportCsv(query) {
  const g = await getGame();
  const dia = query.dia === undefined || query.dia === '' ? null : Number(query.dia);

  const { items } = await repository.listDraws({
    juegoId: g.id,
    mes: Number(query.mes) || null,
    anio: Number(query.anio) || null,
    dia: Number.isInteger(dia) && g.dias.includes(dia) ? dia : null,
    page: 1,
    pageSize: 100_000,
    maxPageSize: 100_000,
  });

  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const columns = [
    { header: 'Fecha', value: (d) => String(d.fecha).slice(0, 10) },
    { header: 'Día', value: (d) => days[d.dia_semana] },
    ...Array.from({ length: g.cantidad_numeros }, (_, i) => ({ header: `Número ${i + 1}`, value: (d) => d.numeros[i] })),
    { header: 'Origen', value: (d) => d.fuente },
  ];
  return toCsv(items, columns);
}

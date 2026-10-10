// Honduras no usa horario de verano: UTC-6 todo el año.
const HONDURAS_OFFSET_HOURS = -6;
const DAY_MS = 86400000;

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** "Ahora" desplazado a Honduras: leer siempre con los getters UTC. */
export function nowInHonduras() {
  return new Date(Date.now() + HONDURAS_OFFSET_HOURS * 3600 * 1000);
}

export function todayInHonduras() {
  return nowInHonduras().toISOString().slice(0, 10);
}

/** Día de la semana (0=domingo ... 6=sábado) de AAAA-MM-DD, o null si no es una fecha real. */
export function weekdayOf(fecha) {
  if (!DATE_REGEX.test(fecha || '')) return null;
  const date = new Date(`${fecha}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== fecha) return null;
  return date.getUTCDay();
}

export function addDays(fecha, days) {
  return new Date(new Date(`${fecha}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function diffDays(desde, hasta) {
  return Math.round((new Date(`${hasta}T00:00:00Z`) - new Date(`${desde}T00:00:00Z`)) / DAY_MS);
}

/** Fechas entre desde y hasta (incluidas) que caen en alguno de los días indicados. */
export function drawDatesBetween(desde, hasta, weekdays) {
  const dates = [];
  for (let d = desde; d <= hasta; d = addDays(d, 1)) {
    if (weekdays.includes(weekdayOf(d))) dates.push(d);
  }
  return dates;
}

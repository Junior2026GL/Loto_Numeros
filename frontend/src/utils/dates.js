const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const dayName = (dia) => DAYS[dia] ?? '';
export const monthName = (mes) => MONTHS[mes - 1] ?? '';

/** "2026-07-15" -> "15 jul 2026" (sin pasar por Date para evitar desfases de zona horaria). */
export function formatDate(fecha) {
  if (!fecha) return '';
  const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

export function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

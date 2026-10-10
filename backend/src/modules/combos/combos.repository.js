import { db } from '../../infrastructure/database/mysql.js';

const COLUMNS = `id, estrategia, numeros, fecha_sorteo_objetivo, jugada, aciertos, evaluada_at, created_at`;

const toDateString = (value) => (value ? String(value).slice(0, 10) : null);

/** mysql2 devuelve JSON ya convertido, pero por seguridad aceptamos también texto. */
const parseNumbers = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

function normalize(row) {
  return {
    ...row,
    numeros: parseNumbers(row.numeros),
    fecha_sorteo_objetivo: toDateString(row.fecha_sorteo_objetivo),
    jugada: Boolean(row.jugada),
  };
}

export async function insertCombination({ usuarioId, juegoId, estrategia, numeros, fechaObjetivo }) {
  const [result] = await db.query(
    `INSERT INTO combinaciones (usuario_id, juego_id, estrategia, numeros, fecha_sorteo_objetivo)
     VALUES (?, ?, ?, ?, ?)`,
    [usuarioId, juegoId, estrategia, JSON.stringify(numeros), fechaObjetivo]
  );
  return result.insertId;
}

export async function findOwned(id, usuarioId) {
  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM combinaciones WHERE id = ? AND usuario_id = ? LIMIT 1`,
    [id, usuarioId]
  );
  return rows[0] ? normalize(rows[0]) : null;
}

export async function listCombinations({ usuarioId, juegoId, page, pageSize }) {
  const limit = Math.max(1, Math.min(50, Number(pageSize) || 10));
  const offset = Math.max(0, (Number(page) || 1) - 1) * limit;

  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) total FROM combinaciones WHERE usuario_id = ? AND juego_id = ?',
    [usuarioId, juegoId]
  );

  const [rows] = await db.query(
    `SELECT ${COLUMNS} FROM combinaciones
     WHERE usuario_id = ? AND juego_id = ?
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [usuarioId, juegoId, limit, offset]
  );

  return { items: rows.map(normalize), total: Number(total) };
}

export async function setPlayed(id, usuarioId, jugada) {
  await db.query('UPDATE combinaciones SET jugada = ? WHERE id = ? AND usuario_id = ?', [jugada ? 1 : 0, id, usuarioId]);
}

export async function deleteOwned(id, usuarioId) {
  await db.query('DELETE FROM combinaciones WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
}

/** Combinaciones sin evaluar cuyo sorteo objetivo ya tiene resultado guardado. */
export async function findPendingEvaluation(usuarioId, juegoId) {
  const [rows] = await db.query(
    `SELECT c.id, c.numeros, s.id AS sorteo_id
     FROM combinaciones c
     JOIN sorteos s ON s.juego_id = c.juego_id AND s.fecha = c.fecha_sorteo_objetivo
     WHERE c.usuario_id = ? AND c.juego_id = ? AND c.evaluada_at IS NULL`,
    [usuarioId, juegoId]
  );
  return rows.map((r) => ({ ...r, numeros: parseNumbers(r.numeros) }));
}

export async function markEvaluated(id, aciertos) {
  await db.query('UPDATE combinaciones SET aciertos = ?, evaluada_at = NOW() WHERE id = ?', [aciertos, id]);
}

/** Resultados (números sorteados) de las fechas pedidas: Map fecha -> [números]. */
export async function loadResults(juegoId, fechas) {
  if (!fechas.length) return new Map();

  const [draws] = await db.query(
    'SELECT id, fecha FROM sorteos WHERE juego_id = ? AND fecha IN (?)',
    [juegoId, fechas]
  );
  if (!draws.length) return new Map();

  const [numbers] = await db.query(
    'SELECT sorteo_id, numero FROM sorteo_numeros WHERE sorteo_id IN (?) ORDER BY numero',
    [draws.map((d) => d.id)]
  );

  const byDraw = new Map();
  for (const row of numbers) {
    if (!byDraw.has(row.sorteo_id)) byDraw.set(row.sorteo_id, []);
    byDraw.get(row.sorteo_id).push(row.numero);
  }

  return new Map(draws.map((d) => [toDateString(d.fecha), byDraw.get(d.id) || []]));
}

export async function loadResultsBySorteoIds(sorteoIds) {
  if (!sorteoIds.length) return new Map();
  const [rows] = await db.query(
    'SELECT sorteo_id, numero FROM sorteo_numeros WHERE sorteo_id IN (?) ORDER BY numero',
    [sorteoIds]
  );
  const byDraw = new Map();
  for (const row of rows) {
    if (!byDraw.has(row.sorteo_id)) byDraw.set(row.sorteo_id, []);
    byDraw.get(row.sorteo_id).push(row.numero);
  }
  return byDraw;
}

export async function performanceByStrategy(usuarioId, juegoId) {
  const [rows] = await db.query(
    `SELECT estrategia,
            COUNT(*) AS guardadas,
            SUM(evaluada_at IS NOT NULL) AS evaluadas,
            AVG(aciertos) AS promedio,
            MAX(aciertos) AS maximo
     FROM combinaciones
     WHERE usuario_id = ? AND juego_id = ?
     GROUP BY estrategia`,
    [usuarioId, juegoId]
  );
  return rows.map((r) => ({
    estrategia: r.estrategia,
    guardadas: Number(r.guardadas),
    evaluadas: Number(r.evaluadas || 0),
    promedio: r.promedio === null ? null : Math.round(Number(r.promedio) * 100) / 100,
    maximo: r.maximo === null ? null : Number(r.maximo),
  }));
}

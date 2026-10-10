import { db } from '../../infrastructure/database/mysql.js';

export async function findDefaultGame() {
  const [rows] = await db.query(
    `SELECT id, codigo, nombre, cantidad_numeros, numero_min, numero_max, dias_sorteo, hora_sorteo
     FROM juegos WHERE activo = 1 ORDER BY id LIMIT 1`
  );
  return rows[0] || null;
}

async function attachNumbers(sorteos) {
  if (!sorteos.length) return sorteos;

  const [rows] = await db.query(
    'SELECT sorteo_id, numero FROM sorteo_numeros WHERE sorteo_id IN (?) ORDER BY sorteo_id, numero',
    [sorteos.map((s) => s.id)]
  );

  const byDraw = new Map();
  for (const row of rows) {
    if (!byDraw.has(row.sorteo_id)) byDraw.set(row.sorteo_id, []);
    byDraw.get(row.sorteo_id).push(row.numero);
  }

  return sorteos.map((s) => ({ ...s, numeros: byDraw.get(s.id) || [] }));
}

export async function listDraws({ juegoId, mes, anio, dia, page, pageSize }) {
  const where = ['s.juego_id = ?'];
  const params = [juegoId];

  if (anio) {
    where.push('YEAR(s.fecha) = ?');
    params.push(anio);
  }
  if (mes) {
    where.push('MONTH(s.fecha) = ?');
    params.push(mes);
  }
  if (dia !== null && dia !== undefined) {
    where.push('s.dia_semana = ?');
    params.push(dia);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) total FROM sorteos s ${whereSql}`, params);

  const limit = Math.max(1, Math.min(100, Number(pageSize) || 20));
  const offset = Math.max(0, (Number(page) || 1) - 1) * limit;

  const [rows] = await db.query(
    `SELECT s.id, s.fecha, s.dia_semana, s.fuente, s.created_at
     FROM sorteos s
     ${whereSql}
     ORDER BY s.fecha DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: await attachNumbers(rows), total: Number(total) };
}

export async function findDrawById(id) {
  const [rows] = await db.query(
    'SELECT id, juego_id, fecha, dia_semana, fuente, created_at FROM sorteos WHERE id = ? LIMIT 1',
    [id]
  );
  const [draw] = await attachNumbers(rows);
  return draw || null;
}

export async function findDrawByDate(juegoId, fecha) {
  const [rows] = await db.query(
    'SELECT id FROM sorteos WHERE juego_id = ? AND fecha = ? LIMIT 1',
    [juegoId, fecha]
  );
  return rows[0] || null;
}

export async function findLastDraw(juegoId) {
  const [rows] = await db.query(
    'SELECT id, fecha, dia_semana, fuente, created_at FROM sorteos WHERE juego_id = ? ORDER BY fecha DESC LIMIT 1',
    [juegoId]
  );
  const [draw] = await attachNumbers(rows);
  return draw || null;
}

export async function countDraws(juegoId) {
  const [[{ total }]] = await db.query('SELECT COUNT(*) total FROM sorteos WHERE juego_id = ?', [juegoId]);
  return Number(total);
}

export async function findMostFrequent(juegoId) {
  const [rows] = await db.query(
    `SELECT numero, veces FROM v_frecuencia_numeros
     WHERE juego_id = ? ORDER BY veces DESC, numero ASC LIMIT 1`,
    [juegoId]
  );
  return rows[0] || null;
}

export async function listAvailableMonths(juegoId) {
  const [rows] = await db.query(
    `SELECT DISTINCT YEAR(fecha) AS anio, MONTH(fecha) AS mes
     FROM sorteos WHERE juego_id = ? ORDER BY anio DESC, mes DESC`,
    [juegoId]
  );
  return rows;
}

export async function createDraw({ juegoId, fecha, numeros, fuente, creadoPor }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      'INSERT INTO sorteos (juego_id, fecha, fuente, creado_por) VALUES (?, ?, ?, ?)',
      [juegoId, fecha, fuente, creadoPor || null]
    );

    const values = numeros.map((numero, index) => [result.insertId, index + 1, numero]);
    await conn.query('INSERT INTO sorteo_numeros (sorteo_id, posicion, numero) VALUES ?', [values]);

    await conn.commit();
    return result.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function deleteDraw(id) {
  await db.query('DELETE FROM sorteos WHERE id = ?', [id]);
}

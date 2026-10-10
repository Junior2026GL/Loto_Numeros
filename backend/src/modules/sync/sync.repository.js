import { db } from '../../infrastructure/database/mysql.js';

export async function createRun({ juegoId, usuarioId, origen, desde, hasta, totalFechas }) {
  const [result] = await db.query(
    `INSERT INTO sincronizaciones (juego_id, usuario_id, origen, fecha_desde, fecha_hasta, total_fechas, estado)
     VALUES (?, ?, ?, ?, ?, ?, 'EN_CURSO')`,
    [juegoId, usuarioId || null, origen, desde, hasta, totalFechas]
  );
  return result.insertId;
}

export async function finishRun(id, { insertados, omitidos, errores, estado, detalle }) {
  await db.query(
    `UPDATE sincronizaciones
     SET insertados = ?, omitidos = ?, errores = ?, estado = ?, detalle = ?, finalizada_at = NOW()
     WHERE id = ?`,
    [insertados, omitidos, errores, estado, detalle || null, id]
  );
}

export async function deleteRun(id) {
  await db.query('DELETE FROM sincronizaciones WHERE id = ?', [id]);
}

/** La ejecución más reciente (para avisar en el dashboard si falló). */
export async function lastRun(juegoId) {
  const [rows] = await db.query(
    `SELECT id, origen, estado, errores, insertados, detalle, iniciada_at, finalizada_at
     FROM sincronizaciones WHERE juego_id = ? ORDER BY id DESC LIMIT 1`,
    [juegoId]
  );
  return rows[0] || null;
}

export async function listRuns({ juegoId, page, pageSize }) {
  const limit = Math.max(1, Math.min(50, Number(pageSize) || 10));
  const offset = Math.max(0, (Number(page) || 1) - 1) * limit;

  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) total FROM sincronizaciones WHERE juego_id = ?',
    [juegoId]
  );

  const [rows] = await db.query(
    `SELECT s.id, s.origen, s.fecha_desde, s.fecha_hasta, s.total_fechas, s.insertados, s.omitidos,
            s.errores, s.estado, s.detalle, s.iniciada_at, s.finalizada_at, u.nombre AS usuario_nombre
     FROM sincronizaciones s
     LEFT JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.juego_id = ?
     ORDER BY s.id DESC
     LIMIT ? OFFSET ?`,
    [juegoId, limit, offset]
  );

  return { items: rows, total: Number(total) };
}

/** Ejecuciones que quedaron "EN_CURSO" porque el servidor se detuvo a mitad de camino. */
export async function failStaleRuns() {
  await db.query(
    `UPDATE sincronizaciones
     SET estado = 'FALLIDA', detalle = 'Interrumpida: el servidor se reinició durante la sincronización', finalizada_at = NOW()
     WHERE estado = 'EN_CURSO'`
  );
}

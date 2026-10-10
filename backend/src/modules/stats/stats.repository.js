import { db } from '../../infrastructure/database/mysql.js';

/** Sorteos del más reciente al más antiguo, con sus números. `ultimos` limita cuántos se leen. */
export async function loadDraws({ juegoId, ultimos, dia }) {
  const where = ['juego_id = ?'];
  const params = [juegoId];
  if (dia !== null && dia !== undefined) {
    where.push('dia_semana = ?');
    params.push(dia);
  }

  const [draws] = await db.query(
    `SELECT id, fecha FROM sorteos WHERE ${where.join(' AND ')} ORDER BY fecha DESC ${ultimos ? 'LIMIT ?' : ''}`,
    ultimos ? [...params, ultimos] : params
  );
  if (!draws.length) return [];

  const [rows] = await db.query(
    'SELECT sorteo_id, numero FROM sorteo_numeros WHERE sorteo_id IN (?)',
    [draws.map((d) => d.id)]
  );

  const byDraw = new Map();
  for (const row of rows) {
    if (!byDraw.has(row.sorteo_id)) byDraw.set(row.sorteo_id, []);
    byDraw.get(row.sorteo_id).push(row.numero);
  }

  return draws.map((d) => ({ fecha: String(d.fecha).slice(0, 10), numeros: byDraw.get(d.id) || [] }));
}

export async function loadConfig() {
  const [rows] = await db.query(
    `SELECT clave, valor FROM configuracion
     WHERE clave IN ('ventana_calientes', 'peso_frecuencia', 'peso_atraso', 'peso_caliente', 'precio_boleto')`
  );
  return Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
}

import { db } from '../../infrastructure/database/mysql.js';

export async function findUserByUsername(usuario) {
  const [rows] = await db.query(
    `SELECT u.id, u.nombre, u.usuario, u.email, u.password_hash, u.activo,
            u.debe_cambiar_password, u.version_sesion, r.nombre AS rol
     FROM usuarios u
     LEFT JOIN roles r ON r.id = u.rol_id
     WHERE u.usuario = ?
     LIMIT 1`,
    [usuario]
  );

  return rows[0] || null;
}

export async function findUserById(id) {
  const [rows] = await db.query(
    `SELECT u.id, u.nombre, u.usuario, u.email, u.activo, u.debe_cambiar_password,
            u.version_sesion, r.nombre AS rol
     FROM usuarios u
     LEFT JOIN roles r ON r.id = u.rol_id
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

export async function touchLastAccess(id) {
  await db.query('UPDATE usuarios SET ultimo_acceso_at = NOW() WHERE id = ?', [id]);
}

export async function findPasswordHashById(id) {
  const [rows] = await db.query(
    'SELECT id, usuario, password_hash FROM usuarios WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/** Guarda una contraseña elegida por el propio usuario: quita la obligación de cambiarla y cierra sus otras sesiones. */
export async function updatePasswordById(id, passwordHash) {
  await db.query(
    'UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0, version_sesion = version_sesion + 1 WHERE id = ?',
    [passwordHash, id]
  );
}

export async function findUserForReset(usuario) {
  const [rows] = await db.query(
    'SELECT id, usuario, nombre, email, activo FROM usuarios WHERE usuario = ? LIMIT 1',
    [usuario]
  );
  return rows[0] || null;
}

export async function countRecentResetCodes(usuarioId, sinceMinutes) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total FROM password_reset_codes
     WHERE usuario_id = ? AND created_at >= (NOW() - INTERVAL ? MINUTE)`,
    [usuarioId, sinceMinutes]
  );
  return Number(rows[0]?.total ?? 0);
}

export async function invalidatePendingResetCodes(usuarioId) {
  await db.query(
    'UPDATE password_reset_codes SET used_at = NOW() WHERE usuario_id = ? AND used_at IS NULL',
    [usuarioId]
  );
}

export async function createResetCode({ usuarioId, codeHash, expiresAt }) {
  const [result] = await db.query(
    'INSERT INTO password_reset_codes (usuario_id, code_hash, expires_at) VALUES (?, ?, ?)',
    [usuarioId, codeHash, expiresAt]
  );
  return result.insertId;
}

export async function findActiveResetCode(usuarioId) {
  const [rows] = await db.query(
    `SELECT id, code_hash, intentos FROM password_reset_codes
     WHERE usuario_id = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [usuarioId]
  );
  return rows[0] || null;
}

export async function incrementResetCodeIntentos(id) {
  await db.query('UPDATE password_reset_codes SET intentos = intentos + 1 WHERE id = ?', [id]);
}

export async function markResetCodeUsed(id) {
  await db.query('UPDATE password_reset_codes SET used_at = NOW() WHERE id = ?', [id]);
}

import { db } from '../../infrastructure/database/mysql.js';

export async function findUserByUsername(usuario) {
  const [rows] = await db.query(
    `SELECT u.id, u.nombre, u.usuario, u.email, u.password_hash, u.activo, r.nombre AS rol
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
    `SELECT u.id, u.nombre, u.usuario, u.email, u.activo, r.nombre AS rol
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
    'SELECT id, password_hash FROM usuarios WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

export async function updatePasswordById(id, passwordHash) {
  await db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

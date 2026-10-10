import { db } from '../../infrastructure/database/mysql.js';

export async function listUsers() {
  const [rows] = await db.query(
    `SELECT u.id, u.nombre, u.usuario, u.email, u.telefono, u.activo, u.rol_id, r.nombre AS rol,
            u.ultimo_acceso_at, u.created_at
     FROM usuarios u
     LEFT JOIN roles r ON r.id = u.rol_id
     ORDER BY u.id DESC`
  );
  return rows;
}

export async function findUserById(id) {
  const [rows] = await db.query(
    `SELECT u.id, u.nombre, u.usuario, u.email, u.telefono, u.activo, u.rol_id, r.nombre AS rol,
            u.ultimo_acceso_at, u.created_at
     FROM usuarios u
     LEFT JOIN roles r ON r.id = u.rol_id
     WHERE u.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function findUsernameOwner(usuario) {
  const [rows] = await db.query('SELECT id FROM usuarios WHERE usuario = ? LIMIT 1', [usuario]);
  return rows[0] || null;
}

export async function listRoles() {
  const [rows] = await db.query('SELECT id, nombre, descripcion FROM roles ORDER BY id');
  return rows;
}

export async function createUser({ nombre, usuario, email, telefono, passwordHash, rolId }) {
  const [result] = await db.query(
    `INSERT INTO usuarios (nombre, usuario, email, telefono, password_hash, rol_id, activo)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [nombre, usuario, email || null, telefono || null, passwordHash, rolId]
  );
  return result.insertId;
}

export async function updateUser(id, { nombre, usuario, email, telefono, rolId }) {
  await db.query(
    `UPDATE usuarios SET nombre = ?, usuario = ?, email = ?, telefono = ?, rol_id = ? WHERE id = ?`,
    [nombre, usuario, email || null, telefono || null, rolId, id]
  );
}

export async function updatePassword(id, passwordHash) {
  await db.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

export async function setActive(id, activo) {
  await db.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]);
}

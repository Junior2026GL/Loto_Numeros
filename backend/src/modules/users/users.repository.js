import { db } from '../../infrastructure/database/mysql.js';

export async function listUsers() {
  const [rows] = await db.query(
    `SELECT u.id, u.nombre, u.usuario, u.email, u.activo, u.debe_cambiar_password, u.rol_id, r.nombre AS rol,
            u.ultimo_acceso_at, u.created_at
     FROM usuarios u
     LEFT JOIN roles r ON r.id = u.rol_id
     ORDER BY u.id DESC`
  );
  return rows;
}

export async function findUserById(id) {
  const [rows] = await db.query(
    `SELECT u.id, u.nombre, u.usuario, u.email, u.activo, u.debe_cambiar_password, u.rol_id, r.nombre AS rol,
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

export async function createUser({ nombre, usuario, email, passwordHash, rolId }) {
  const [result] = await db.query(
    `INSERT INTO usuarios (nombre, usuario, email, password_hash, rol_id, activo, debe_cambiar_password)
     VALUES (?, ?, ?, ?, ?, 1, 1)`,
    [nombre, usuario, email || null, passwordHash, rolId]
  );
  return result.insertId;
}

export async function updateUser(id, { nombre, usuario, email, rolId }) {
  await db.query(
    `UPDATE usuarios SET nombre = ?, usuario = ?, email = ?, rol_id = ? WHERE id = ?`,
    [nombre, usuario, email || null, rolId, id]
  );
}

export async function updatePassword(id, passwordHash) {
  // Un admin define una contraseña temporal: el usuario debe cambiarla y sus sesiones anteriores caducan.
  await db.query(
    'UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 1, version_sesion = version_sesion + 1 WHERE id = ?',
    [passwordHash, id]
  );
}

export async function setActive(id, activo) {
  await db.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]);
}

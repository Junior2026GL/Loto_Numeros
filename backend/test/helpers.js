import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
import { applyMigrations } from '../src/infrastructure/database/migrator.js';

const SETUP_SQL = resolve(dirname(fileURLToPath(import.meta.url)), '../src/infrastructure/database/setup.sql');

export const PASSWORD = 'PruebaSegura2026';

/** Crea desde cero la base de pruebas con el esquema real (setup.sql + migraciones). */
export async function createTestDatabase() {
  const name = env.db.database;
  if (!name.endsWith('_test')) throw new Error(`Por seguridad las pruebas solo corren en bases *_test (no en "${name}")`);

  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  });

  await conn.query(`DROP DATABASE IF EXISTS \`${name}\``);
  const sql = readFileSync(SETUP_SQL, 'utf8')
    .replace('CREATE DATABASE IF NOT EXISTS loto_numeros', `CREATE DATABASE IF NOT EXISTS ${name}`)
    .replace('USE loto_numeros;', `USE ${name};`);
  await conn.query(sql);
  await applyMigrations(conn);

  // El superadmin de setup.sql ya no sirve para pruebas: se le pone una contraseña conocida.
  await conn.query('UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0 WHERE usuario = ?', [
    await bcrypt.hash(PASSWORD, 4),
    'superadmin',
  ]);
  return conn;
}

/** Inserta un usuario directamente en la base (rápido y sin pasar por la API). */
export async function insertUser(conn, { usuario, rol, email = null, mustChange = false, active = true }) {
  const [[role]] = await conn.query('SELECT id FROM roles WHERE nombre = ?', [rol]);
  const [result] = await conn.query(
    `INSERT INTO usuarios (rol_id, nombre, usuario, email, password_hash, activo, debe_cambiar_password)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [role.id, `Prueba ${usuario}`, usuario, email, await bcrypt.hash(PASSWORD, 4), active ? 1 : 0, mustChange ? 1 : 0]
  );
  return result.insertId;
}

/** Cliente HTTP mínimo sobre la app real, escuchando en un puerto libre. */
export async function startApi() {
  const { app } = await import('../src/app.js');
  const server = await new Promise((resolveListen) => {
    const s = app.listen(0, '127.0.0.1', () => resolveListen(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function request(method, path, { token, body } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, ...json };
  }

  async function login(usuario, password = PASSWORD) {
    const res = await request('POST', '/auth/login', { body: { usuario, password } });
    return { ...res, token: res.data?.token };
  }

  return { base, request, login, close: () => new Promise((r) => server.close(r)) };
}

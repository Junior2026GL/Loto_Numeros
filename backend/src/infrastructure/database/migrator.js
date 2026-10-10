import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Aplica las migraciones pendientes usando una conexión mysql2 con multipleStatements.
 * Devuelve los nombres de las que se aplicaron.
 */
export async function applyMigrations(conn, { onApply } = {}) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre      VARCHAR(150) PRIMARY KEY,
      aplicada_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  const [applied] = await conn.query('SELECT nombre FROM schema_migrations');
  const done = new Set(applied.map((r) => r.nombre));
  const pending = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && !done.has(f)).sort();

  for (const file of pending) {
    onApply?.(file);
    await conn.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    await conn.query('INSERT INTO schema_migrations (nombre) VALUES (?)', [file]);
  }
  return pending;
}

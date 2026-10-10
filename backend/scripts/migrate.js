// Aplica las migraciones pendientes de la base de datos.
//
//   npm run migrate
//
// Las migraciones son archivos SQL numerados en src/infrastructure/database/migrations.
// Cada una se aplica una sola vez (queda registrada en la tabla schema_migrations).
// setup.sql crea la base inicial; después se ejecuta este comando para llevarla al día.
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
import { applyMigrations } from '../src/infrastructure/database/migrator.js';

const conn = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  multipleStatements: true,
});

try {
  const applied = await applyMigrations(conn, {
    onApply: (file) => process.stdout.write(`Aplicando ${file}... `),
  });
  if (applied.length) console.log('listo');
  else console.log('La base de datos ya está al día.');
} catch (error) {
  console.error(`\nLa migración falló: ${error.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}

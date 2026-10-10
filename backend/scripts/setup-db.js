// Crea la base de datos completa: ejecuta setup.sql y luego aplica las migraciones.
//
//   npm run db:setup
//
// Usa la conexión del .env (o de las variables DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
// Es seguro repetirlo: no borra nada y no duplica datos. No necesita MySQL Workbench ni el cliente
// de línea de comandos de MySQL: se conecta directamente desde Node.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
import { applyMigrations } from '../src/infrastructure/database/migrator.js';

const SETUP_SQL = resolve(dirname(fileURLToPath(import.meta.url)), '../src/infrastructure/database/setup.sql');
const name = env.db.database;

if (!/^[A-Za-z0-9_]+$/.test(name)) {
  console.error('DB_NAME solo puede tener letras, números y guion bajo.');
  process.exit(1);
}

console.log(`Servidor: ${env.db.host}:${env.db.port}  |  usuario: ${env.db.user}  |  base: ${name}`);

const conn = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  multipleStatements: true,
});

try {
  // setup.sql usa el nombre loto_numeros; se adapta al de DB_NAME para poder crear otras bases (pruebas, etc.).
  const sql = readFileSync(SETUP_SQL, 'utf8')
    .replace('CREATE DATABASE IF NOT EXISTS loto_numeros', `CREATE DATABASE IF NOT EXISTS ${name}`)
    .replace('USE loto_numeros;', `USE ${name};`);

  process.stdout.write('1/2 Creando tablas y datos iniciales (setup.sql)... ');
  await conn.query(sql);
  console.log('listo');

  process.stdout.write('2/2 Aplicando migraciones... ');
  const applied = await applyMigrations(conn);
  console.log(applied.length ? `listo (${applied.join(', ')})` : 'ya estaba al día');

  const [[counts]] = await conn.query(
    'SELECT (SELECT COUNT(*) FROM sorteos) AS sorteos, (SELECT COUNT(*) FROM usuarios) AS usuarios, (SELECT COUNT(*) FROM roles) AS roles'
  );
  console.log(`\nBase "${name}" lista: ${counts.sorteos} sorteos, ${counts.usuarios} usuario(s), ${counts.roles} roles.`);
} catch (error) {
  console.error(`\nNo se pudo preparar la base: ${error.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}

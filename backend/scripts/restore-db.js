// Restaura una copia de seguridad (.sql) en una base de datos.
//
//   npm run restore -- backups/loto_numeros_2026-10-09_1904.sql loto_numeros_restaurada
//
// Por seguridad exige indicar la base de destino. Restaurar sobre la base en uso (la del .env)
// reemplaza todos sus datos y solo se hace con --confirmar-sobrescribir.
import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

const WINDOWS_DEFAULT = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe';

const args = process.argv.slice(2);
const overwrite = args.includes('--confirmar-sobrescribir');
const [file, target] = args.filter((a) => !a.startsWith('--'));

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!file || !target) {
  fail('Uso: npm run restore -- <archivo.sql> <base_destino> [--confirmar-sobrescribir]');
}
if (!existsSync(file)) fail(`No existe el archivo: ${file}`);
if (!/^[A-Za-z0-9_]+$/.test(target)) fail('El nombre de la base solo puede tener letras, números y guion bajo.');
if (target === env.db.database && !overwrite) {
  fail(`"${target}" es la base en uso. Restaurar sobre ella reemplaza todos sus datos: agrega --confirmar-sobrescribir si es lo que quieres.`);
}

const admin = await mysql.createConnection({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
});
await admin.query(`CREATE DATABASE IF NOT EXISTS \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await admin.end();

const binary = process.env.MYSQL_PATH
  || (process.platform === 'win32' && existsSync(WINDOWS_DEFAULT) ? WINDOWS_DEFAULT : 'mysql');

const child = spawn(
  binary,
  [`--host=${env.db.host}`, `--port=${env.db.port}`, `--user=${env.db.user}`, '--default-character-set=utf8mb4', target],
  { env: { ...process.env, MYSQL_PWD: env.db.password }, stdio: ['pipe', 'inherit', 'pipe'] }
);

let errors = '';
child.stderr.on('data', (chunk) => { errors += chunk; });
child.on('error', (error) => fail(`No se pudo ejecutar mysql (${binary}): ${error.message}\nDefine MYSQL_PATH con su ruta completa.`));
child.on('close', (code) => {
  if (code !== 0) fail(`La restauración falló (código ${code}):\n${errors.trim()}`);
  console.log(`Copia restaurada en la base "${target}".`);
});

createReadStream(file).pipe(child.stdin);

// Copia de seguridad de la base de datos con mysqldump.
//
//   npm run backup                 -> crea backups/loto_numeros_AAAA-MM-DD_HHMM.sql
//
// Lee la conexión del .env. Si mysqldump no está en el PATH, define MYSQLDUMP_PATH
// (por ejemplo: C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe).
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';

const WINDOWS_DEFAULT = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(backend, 'backups');
mkdirSync(outDir, { recursive: true });

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
const outFile = join(outDir, `${env.db.database}_${stamp}.sql`);

const binary = process.env.MYSQLDUMP_PATH
  || (process.platform === 'win32' && existsSync(WINDOWS_DEFAULT) ? WINDOWS_DEFAULT : 'mysqldump');

const args = [
  `--host=${env.db.host}`,
  `--port=${env.db.port}`,
  `--user=${env.db.user}`,
  '--single-transaction', // copia consistente sin bloquear la base
  '--routines',
  '--no-tablespaces',
  '--default-character-set=utf8mb4',
  env.db.database,
];

// La contraseña va por variable de entorno: así no aparece en la lista de procesos.
const child = spawn(binary, args, {
  env: { ...process.env, MYSQL_PWD: env.db.password },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const output = createWriteStream(outFile);
child.stdout.pipe(output);

let errors = '';
child.stderr.on('data', (chunk) => { errors += chunk; });

child.on('error', (error) => {
  rmSync(outFile, { force: true });
  console.error(`No se pudo ejecutar mysqldump (${binary}): ${error.message}`);
  console.error('Define MYSQLDUMP_PATH con la ruta completa de mysqldump.');
  process.exit(1);
});

child.on('close', (code) => {
  output.end(() => {
    if (code !== 0) {
      rmSync(outFile, { force: true });
      console.error(`mysqldump falló (código ${code}):\n${errors.trim()}`);
      process.exit(1);
    }
    console.log(`Copia creada: ${outFile}`);
  });
});

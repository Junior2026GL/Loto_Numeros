// Ejecuta los archivos *.test.js de una carpeta con el ejecutor de pruebas de Node.
//
//   node scripts/run-tests.js src            -> pruebas unitarias
//   node scripts/run-tests.js test --serial  -> pruebas de la API (una a la vez: comparten la base de pruebas)
//
// Busca los archivos por su cuenta en lugar de usar un patrón (`node --test "src/**/*.test.js"`),
// porque Node 20 no entiende esos patrones y fallaba en la integración continua.
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const serial = args.includes('--serial');
const dir = resolve(args.find((a) => !a.startsWith('--')) || 'src');

function findTests(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : findTests(path);
    return name.endsWith('.test.js') ? [path] : [];
  });
}

const files = findTests(dir).sort();
if (files.length === 0) {
  console.error(`No se encontraron archivos *.test.js en ${dir}`);
  process.exit(1);
}

const nodeArgs = ['--test', ...(serial ? ['--test-concurrency=1'] : []), ...files];
const result = spawnSync(process.execPath, nodeArgs, { stdio: 'inherit' });
process.exit(result.status ?? 1);

// Genera dos archivos .sql para ejecutar a mano (por ejemplo en MySQL Workbench) sobre una base remota:
//
//   npm run db:sql -- railway
//
//   backups/<base>_1_vaciar.sql  -> borra todas las tablas y la vista de esa base
//   backups/<base>_2_crear.sql   -> crea todo (setup.sql + migraciones); ejecutarlo una vez, en una base vacía
//
// Se generan a partir de setup.sql y de la carpeta migrations, así nunca quedan desactualizados.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbDir = join(root, 'src/infrastructure/database');
const outDir = join(root, 'backups');

const name = process.argv[2] || env.db.database;
if (!/^[A-Za-z0-9_]+$/.test(name)) {
  console.error('El nombre de la base solo puede tener letras, números y guion bajo.');
  process.exit(1);
}

const TABLES_IN_DROP_ORDER = [
  'password_reset_codes',
  'combinaciones',
  'sincronizaciones',
  'auditoria',
  'sorteo_numeros',
  'sorteos',
  'juegos',
  'configuracion',
  'usuarios',
  'roles',
  'schema_migrations',
];

const drop = `-- VACIAR la base "${name}": borra TODAS sus tablas y la vista. Es irreversible.
USE ${name};

SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS v_frecuencia_numeros;

DROP TABLE IF EXISTS
  ${TABLES_IN_DROP_ORDER.join(',\n  ')};

SET FOREIGN_KEY_CHECKS = 1;

SHOW TABLES;
`;

const setup = readFileSync(join(dbDir, 'setup.sql'), 'utf8')
  .replace('CREATE DATABASE IF NOT EXISTS loto_numeros', `CREATE DATABASE IF NOT EXISTS ${name}`)
  .replace('USE loto_numeros;', `USE ${name};`);

const migrationFiles = readdirSync(join(dbDir, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
const migrations = migrationFiles
  .map((file) => `-- ---- Migración ${file} ----\n${readFileSync(join(dbDir, 'migrations', file), 'utf8')}`)
  .join('\n');

const register = `-- ---- Registro de migraciones aplicadas (para que "npm run migrate" sepa que ya están) ----
CREATE TABLE IF NOT EXISTS schema_migrations (
  nombre      VARCHAR(150) PRIMARY KEY,
  aplicada_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations (nombre) VALUES
${migrationFiles.map((f) => `  ('${f}')`).join(',\n')};

-- ---- Verificación final ----
SELECT (SELECT COUNT(*) FROM sorteos)  AS sorteos,
       (SELECT COUNT(*) FROM usuarios) AS usuarios,
       (SELECT COUNT(*) FROM roles)    AS roles;
SHOW TABLES;
`;

const create = `-- CREAR toda la base "${name}" (generado de setup.sql + migraciones).
-- Ejecútalo COMPLETO y UNA sola vez, en una base VACÍA (si ya tiene tablas, ejecuta primero el archivo 1_vaciar).

${setup}

${migrations}

${register}`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${name}_1_vaciar.sql`), drop);
writeFileSync(join(outDir, `${name}_2_crear.sql`), create);
console.log(`Generados en backups/:\n  ${name}_1_vaciar.sql\n  ${name}_2_crear.sql`);

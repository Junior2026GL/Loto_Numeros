import { z } from 'zod';
import { AppError } from '../../shared/errors/AppError.js';
import { db } from '../../infrastructure/database/mysql.js';
import { loadConfig } from '../stats/stats.repository.js';

const DEFAULTS = { ventanaCalientes: 5, pesos: { frecuencia: 50, atraso: 35, caliente: 15 } };

const weight = z.coerce.number({ invalid_type_error: 'Los pesos deben ser números' })
  .int('Los pesos deben ser números enteros')
  .min(0, 'Los pesos deben estar entre 0 y 100')
  .max(100, 'Los pesos deben estar entre 0 y 100');

const schema = z.object({
  ventanaCalientes: z.coerce.number({ invalid_type_error: 'La ventana debe ser un número' })
    .int('La ventana debe ser un número entero')
    .min(1, 'La ventana debe ser de al menos 1 sorteo')
    .max(50, 'La ventana no puede superar los 50 sorteos'),
  pesos: z.object({ frecuencia: weight, atraso: weight, caliente: weight }),
});

const toNumber = (value, fallback) => (Number.isFinite(Number(value)) && value !== undefined ? Number(value) : fallback);

export async function get() {
  const raw = await loadConfig();
  return {
    ventanaCalientes: toNumber(raw.ventana_calientes, DEFAULTS.ventanaCalientes),
    pesos: {
      frecuencia: toNumber(raw.peso_frecuencia, DEFAULTS.pesos.frecuencia),
      atraso: toNumber(raw.peso_atraso, DEFAULTS.pesos.atraso),
      caliente: toNumber(raw.peso_caliente, DEFAULTS.pesos.caliente),
    },
  };
}

export async function update(payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Datos inválidos');

  const { ventanaCalientes, pesos } = parsed.data;
  if (pesos.frecuencia + pesos.atraso + pesos.caliente === 0) {
    throw new AppError('Al menos uno de los pesos debe ser mayor que 0');
  }

  const rows = [
    ['ventana_calientes', ventanaCalientes],
    ['peso_frecuencia', pesos.frecuencia],
    ['peso_atraso', pesos.atraso],
    ['peso_caliente', pesos.caliente],
  ].map(([clave, valor]) => [clave, String(valor)]);

  await db.query(
    'INSERT INTO configuracion (clave, valor) VALUES ? ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
    [rows]
  );
  return get();
}

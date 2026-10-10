import test from 'node:test';
import assert from 'node:assert/strict';
import { backtest, seededRng } from './combos.backtest.js';
import { STRATEGY_CODES } from './combos.generator.js';

const game = { cantidad_numeros: 6, numero_min: 1, numero_max: 33 };

/** Historial sintético 100 % aleatorio (la hipótesis nula: ninguna estrategia puede ganarle al azar). */
function randomHistory(count, seed) {
  const rng = seededRng(seed);
  return Array.from({ length: count }, (_, i) => {
    const pool = Array.from({ length: 33 }, (_, n) => n + 1);
    const numeros = [];
    while (numeros.length < 6) numeros.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return { fecha: `2026-01-${String(i + 1).padStart(2, '0')}`, numeros: numeros.sort((a, b) => a - b) };
  });
}

test('evalúa solo los sorteos que tienen suficiente historia previa', () => {
  const result = backtest(randomHistory(30, 1), game, {}, { combinaciones: 5, minimo: 20 });
  assert.equal(result.sorteosEvaluados, 10);
  assert.deepEqual(result.estrategias.map((e) => e.codigo), STRATEGY_CODES);
  assert.ok(result.estrategias.every((e) => e.muestras === 10 * 5));
});

test('sin historia suficiente no devuelve promedios', () => {
  const result = backtest(randomHistory(10, 1), game, {}, { minimo: 20 });
  assert.equal(result.sorteosEvaluados, 0);
  assert.ok(result.estrategias.every((e) => e.promedio === null));
});

test('es determinista: el mismo historial y semilla dan el mismo resultado', () => {
  const history = randomHistory(40, 7);
  const a = backtest(history, game, {}, { combinaciones: 10 });
  const b = backtest(history, game, {}, { combinaciones: 10 });
  assert.deepEqual(a, b);
});

test('con sorteos puramente aleatorios ninguna estrategia se distingue del azar', () => {
  // 200 sorteos: aciertos esperados por azar = 6*6/33 = 1.09.
  const result = backtest(randomHistory(200, 123), game, {}, { combinaciones: 20, minimo: 30 });
  assert.equal(result.promedioPorAzar, 1.09);
  for (const e of result.estrategias) {
    assert.ok(Math.abs(e.promedio - 1.09) < 0.15, `${e.codigo}: ${e.promedio} se aleja demasiado de 1.09`);
  }
  // Con 7 estrategias y 95 % de confianza es normal que alguna salga "significativa" por casualidad,
  // pero no deberían ser la mayoría.
  assert.ok(result.estrategias.filter((e) => e.distinguibleDelAzar).length <= 2);
});

test('detecta una estrategia que sí aprovecha un patrón real (sensibilidad de la prueba)', () => {
  // Historial trucado: el 7 aparece SIEMPRE. La estrategia por frecuencia debe aprovecharlo.
  const rng = seededRng(5);
  const rigged = Array.from({ length: 120 }, (_, i) => {
    const pool = Array.from({ length: 32 }, (_, n) => (n + 1 >= 7 ? n + 2 : n + 1));
    const numeros = [7];
    while (numeros.length < 6) numeros.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return { fecha: `2026-02-${String(i + 1).padStart(2, '0')}`, numeros: numeros.sort((a, b) => a - b) };
  });
  const result = backtest(rigged, game, {}, { combinaciones: 30, minimo: 30 });
  const byFrequency = result.estrategias.find((e) => e.codigo === 'FRECUENCIA');
  const pure = result.estrategias.find((e) => e.codigo === 'AZAR');
  assert.ok(byFrequency.promedio > pure.promedio, 'la frecuencia debe superar al azar si hay un patrón');
  assert.equal(byFrequency.distinguibleDelAzar, true);
});

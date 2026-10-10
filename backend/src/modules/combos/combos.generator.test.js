import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../stats/stats.calculator.js';
import { STRATEGY_CODES, countHits, generateAll, generateCombination } from './combos.generator.js';

const game = { cantidad_numeros: 6, numero_min: 1, numero_max: 33 };

const history = [
  { fecha: '2026-07-15', numeros: [8, 11, 15, 18, 19, 29] },
  { fecha: '2026-07-11', numeros: [1, 4, 13, 19, 21, 33] },
  { fecha: '2026-07-08', numeros: [6, 8, 13, 17, 24, 26] },
  { fecha: '2026-07-04', numeros: [4, 5, 11, 15, 20, 33] },
];

// Generador pseudoaleatorio determinista (mulberry32) para pruebas repetibles.
function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertValid(numbers) {
  assert.equal(numbers.length, 6);
  assert.equal(new Set(numbers).size, 6, 'sin números repetidos');
  assert.ok(numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 33), 'dentro del rango');
  assert.deepEqual([...numbers].sort((a, b) => a - b), numbers, 'ordenados');
}

test('toda estrategia devuelve 6 números distintos, ordenados y en rango (muchas veces)', () => {
  const stats = computeStats(history, game);
  const rng = seeded(1);
  for (const code of STRATEGY_CODES) {
    for (let i = 0; i < 200; i += 1) assertValid(generateCombination(code, stats, game, rng));
  }
});

test('funciona sin historial (todas las estadísticas en cero)', () => {
  const stats = computeStats([], game);
  const rng = seeded(7);
  for (const code of STRATEGY_CODES) assertValid(generateCombination(code, stats, game, rng));
});

test('es repetible con la misma semilla y cambia con otra', () => {
  const stats = computeStats(history, game);
  const a = generateCombination('AZAR', stats, game, seeded(42));
  const b = generateCombination('AZAR', stats, game, seeded(42));
  const c = generateCombination('AZAR', stats, game, seeded(43));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('CALIENTES prioriza los números calientes', () => {
  const stats = computeStats(history, game, { ventanaCalientes: 2 });
  const hot = new Set(stats.calientes);
  const combo = generateCombination('CALIENTES', stats, game, seeded(3));
  const fromHot = combo.filter((n) => hot.has(n)).length;
  assert.equal(fromHot, Math.min(6, hot.size));
});

test('AZAR puro reparte los números de forma pareja', () => {
  const stats = computeStats(history, game);
  const rng = seeded(99);
  const counts = new Map();
  const runs = 5000;
  for (let i = 0; i < runs; i += 1) {
    for (const n of generateCombination('AZAR', stats, game, rng)) counts.set(n, (counts.get(n) || 0) + 1);
  }
  const expected = (runs * 6) / 33;
  for (let n = 1; n <= 33; n += 1) {
    const c = counts.get(n) || 0;
    assert.ok(Math.abs(c - expected) < expected * 0.2, `el ${n} salió ${c} veces (esperado ~${Math.round(expected)})`);
  }
});

test('generateAll devuelve una combinación por estrategia con su descripción', () => {
  const all = generateAll(computeStats(history, game), game, seeded(5));
  assert.deepEqual(all.map((s) => s.codigo), STRATEGY_CODES);
  assert.ok(all.every((s) => s.nombre && s.descripcion));
  all.forEach((s) => assertValid(s.numeros));
});

test('una estrategia desconocida lanza error', () => {
  assert.throws(() => generateCombination('MAGIA', computeStats(history, game), game), /desconocida/);
});

test('countHits cuenta los aciertos', () => {
  assert.equal(countHits([1, 2, 3, 4, 5, 6], [4, 5, 6, 7, 8, 9]), 3);
  assert.equal(countHits([1, 2, 3, 4, 5, 6], [10, 11, 12, 13, 14, 15]), 0);
  assert.equal(countHits([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]), 6);
});

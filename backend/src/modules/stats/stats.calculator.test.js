import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from './stats.calculator.js';

const game = { cantidad_numeros: 6, numero_min: 1, numero_max: 33 };

// Del más reciente al más antiguo.
const draws = [
  { fecha: '2026-07-15', numeros: [8, 11, 15, 18, 19, 29] },
  { fecha: '2026-07-11', numeros: [1, 4, 13, 19, 21, 33] },
  { fecha: '2026-07-08', numeros: [6, 8, 13, 17, 24, 26] },
  { fecha: '2026-07-04', numeros: [4, 5, 11, 15, 20, 33] },
];

test('sin sorteos devuelve todo en cero y no divide por cero', () => {
  const stats = computeStats([], game);
  assert.equal(stats.totalSorteos, 0);
  assert.equal(stats.frecuencia.length, 33);
  assert.ok(stats.frecuencia.every((f) => f.veces === 0 && Number.isFinite(f.score)));
  assert.equal(stats.suma.promedio, 0);
});

test('cuenta la frecuencia de cada número', () => {
  const { frecuencia } = computeStats(draws, game);
  const veces = (n) => frecuencia.find((f) => f.numero === n).veces;
  assert.equal(veces(19), 2);
  assert.equal(veces(13), 2);
  assert.equal(veces(8), 2);
  assert.equal(veces(2), 0);
});

test('cada sorteo suma 6 apariciones', () => {
  const { frecuencia } = computeStats(draws, game);
  assert.equal(frecuencia.reduce((acc, f) => acc + f.veces, 0), draws.length * 6);
});

test('sorteos sin salir: 0 si salió en el último sorteo, el total si nunca salió', () => {
  const { frecuencia } = computeStats(draws, game);
  const find = (n) => frecuencia.find((f) => f.numero === n);
  assert.equal(find(29).sorteosSinSalir, 0);
  assert.equal(find(1).sorteosSinSalir, 1);
  assert.equal(find(5).sorteosSinSalir, 3);
  assert.equal(find(2).sorteosSinSalir, 4);
  assert.equal(find(29).ultimaFecha, '2026-07-15');
  assert.equal(find(2).ultimaFecha, null);
});

test('los calientes salen solo de la ventana reciente', () => {
  const { calientes } = computeStats(draws, game, { ventanaCalientes: 1 });
  assert.deepEqual(calientes, [8, 11, 15, 18, 19, 29]);
});

test('el número esperado por número es total * 6 / 33', () => {
  assert.equal(computeStats(draws, game).esperadoPorNumero, round1((4 * 6) / 33));
});

test('pares: cuenta coincidencias y los ordena de más a menos repetido', () => {
  const { paresFrecuentes } = computeStats(draws, game);
  const pair = (a, b) => paresFrecuentes.find((p) => p.a === a && p.b === b);
  assert.ok(paresFrecuentes.every((p) => p.a < p.b));
  assert.equal(pair(4, 33)?.veces, 2);
  assert.equal(pair(11, 15)?.veces, 2);
  assert.deepEqual([paresFrecuentes[0], paresFrecuentes[1]].map((p) => p.veces), [2, 2]);
  assert.ok(paresFrecuentes.every((p, i) => i === 0 || paresFrecuentes[i - 1].veces >= p.veces));
});

test('la mejor combinación tiene 6 números distintos, ordenados y dentro del rango', () => {
  const { mejorCombinacion } = computeStats(draws, game);
  assert.equal(mejorCombinacion.length, 6);
  assert.equal(new Set(mejorCombinacion).size, 6);
  assert.deepEqual([...mejorCombinacion].sort((a, b) => a - b), mejorCombinacion);
  assert.ok(mejorCombinacion.every((n) => n >= 1 && n <= 33));
});

test('paridad: la suma de sorteos de la distribución es el total de sorteos', () => {
  const { paridad } = computeStats(draws, game);
  assert.equal(paridad.length, 7);
  assert.equal(paridad.reduce((acc, p) => acc + p.sorteos, 0), draws.length);
});

test('suma: promedio, mínimo y máximo', () => {
  const { suma } = computeStats(draws, game);
  // 100, 91, 94, 88
  assert.equal(suma.minimo, 88);
  assert.equal(suma.maximo, 100);
  assert.equal(suma.promedio, 93.3);
});

test('pesos inválidos usan los pesos por defecto', () => {
  const a = computeStats(draws, game, { pesos: { frecuencia: -1, atraso: 'x', caliente: 0 } });
  const b = computeStats(draws, game, { pesos: { frecuencia: 50, atraso: 35, caliente: 15 } });
  assert.deepEqual(a.mejorCombinacion, b.mejorCombinacion);
});

function round1(v) {
  return Math.round(v * 10) / 10;
}

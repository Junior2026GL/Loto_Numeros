import test from 'node:test';
import assert from 'node:assert/strict';
import { chiSquarePValue, uniformityTest } from './chi-square.js';

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} no está cerca de ${expected}`);

test('p-valores conocidos de la distribución chi-cuadrado', () => {
  near(chiSquarePValue(3.841459, 1), 0.05, 0.0005, 'df=1, 3.84');
  near(chiSquarePValue(5.991465, 2), 0.05, 0.0005, 'df=2, 5.99');
  near(chiSquarePValue(18.307038, 10), 0.05, 0.0005, 'df=10, 18.31');
  near(chiSquarePValue(43.772973, 32), 0.08, 0.005, 'df=32, 43.77');
  near(chiSquarePValue(46.194, 32), 0.05, 0.001, 'df=32, 46.19');
  // Con 2 grados de libertad la fórmula exacta es exp(-x/2).
  near(chiSquarePValue(2, 2), Math.exp(-1), 1e-9, 'df=2 exacto');
  near(chiSquarePValue(10, 2), Math.exp(-5), 1e-9, 'df=2 exacto (cola)');
});

test('casos límite', () => {
  assert.equal(chiSquarePValue(0, 32), 1);
  assert.ok(chiSquarePValue(500, 32) < 1e-10);
  const mediana = chiSquarePValue(31.336, 32);
  near(mediana, 0.5, 0.01, 'la mediana de chi2(32) deja la mitad');
});

test('frecuencias perfectamente parejas dan chi2 = 0 y p = 1', () => {
  const result = uniformityTest(Array(33).fill(10), 10);
  assert.equal(result.chi2, 0);
  assert.equal(result.pValor, 1);
  assert.equal(result.gradosLibertad, 32);
});

test('una distribución muy sesgada da un p-valor minúsculo', () => {
  const observed = Array(33).fill(1);
  observed[0] = 300;
  assert.ok(uniformityTest(observed, 10).pValor < 0.001);
});

test('sin datos devuelve null', () => {
  assert.equal(uniformityTest([], 5), null);
  assert.equal(uniformityTest([1, 2], 0), null);
});

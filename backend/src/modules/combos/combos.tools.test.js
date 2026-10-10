import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../stats/stats.calculator.js';
import { seededRng } from './combos.backtest.js';
import { STRATEGY_CODES, countHits, generateBatch, generateCombination, isBalanced } from './combos.generator.js';
import { choose, hypergeometric, prizeOdds } from './combos.odds.js';
import { buildWheel } from './combos.wheel.js';
import { simulateCombination } from './combos.simulate.js';

const game = { cantidad_numeros: 6, numero_min: 1, numero_max: 33 };

const history = [
  { fecha: '2026-07-15', numeros: [8, 11, 15, 18, 19, 29] },
  { fecha: '2026-07-11', numeros: [1, 4, 13, 19, 21, 33] },
  { fecha: '2026-07-08', numeros: [6, 8, 13, 17, 24, 26] },
  { fecha: '2026-07-04', numeros: [4, 5, 11, 15, 20, 33] },
];
const stats = computeStats(history, game);

/* ------------------------------------------------------------------ fijos, excluidos y equilibrio */

test('los números fijos siempre están en la combinación, con cualquier estrategia', () => {
  const rng = seededRng(11);
  for (const code of STRATEGY_CODES) {
    for (let i = 0; i < 100; i += 1) {
      const combo = generateCombination(code, stats, game, rng, { fijos: [7, 21] });
      assert.equal(combo.length, 6, `${code} debe dar 6 números`);
      assert.equal(new Set(combo).size, 6);
      assert.ok(combo.includes(7) && combo.includes(21), `${code} perdió un número fijo`);
    }
  }
});

test('los números excluidos nunca aparecen, con cualquier estrategia', () => {
  const rng = seededRng(12);
  const excluidos = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  for (const code of STRATEGY_CODES) {
    for (let i = 0; i < 100; i += 1) {
      const combo = generateCombination(code, stats, game, rng, { excluidos });
      assert.equal(combo.length, 6, `${code} debe dar 6 números`);
      assert.ok(combo.every((n) => !excluidos.includes(n)), `${code} usó un número excluido: ${combo}`);
    }
  }
});

test('fijos y excluidos juntos se respetan', () => {
  const rng = seededRng(13);
  for (let i = 0; i < 100; i += 1) {
    const combo = generateCombination('AZAR', stats, game, rng, { fijos: [10], excluidos: [11, 12, 13] });
    assert.ok(combo.includes(10));
    assert.ok(![11, 12, 13].some((n) => combo.includes(n)));
  }
});

test('isBalanced rechaza patrones raros y acepta combinaciones típicas', () => {
  assert.equal(isBalanced([1, 2, 3, 4, 5, 6], game), false, 'consecutivos');
  assert.equal(isBalanced([5, 10, 15, 20, 25, 30], game), false, 'progresión aritmética');
  assert.equal(isBalanced([2, 4, 6, 8, 10, 12], game), false, 'todos pares');
  assert.equal(isBalanced([1, 3, 5, 7, 9, 11], game), false, 'todos impares');
  assert.equal(isBalanced([28, 29, 30, 31, 32, 33], game), false, 'consecutivos altos');
  assert.equal(isBalanced([8, 11, 15, 18, 19, 29], game), true, 'un sorteo real');
  assert.equal(isBalanced([4, 17, 18, 20, 28, 33], game), true, 'otro sorteo real');
});

test('con el filtro activado, las combinaciones salen equilibradas', () => {
  const rng = seededRng(14);
  for (const code of STRATEGY_CODES) {
    for (let i = 0; i < 100; i += 1) {
      const combo = generateCombination(code, stats, game, rng, { equilibrada: true });
      assert.ok(isBalanced(combo, game), `${code}: ${combo} no es equilibrada`);
    }
  }
});

test('los sorteos reales del historial casi siempre son "equilibrados" (el filtro no distorsiona)', () => {
  const real = [
    [4, 17, 18, 20, 28, 33], [5, 7, 8, 18, 20, 26], [1, 7, 9, 14, 30, 33], [10, 14, 15, 19, 31, 32],
    [7, 10, 12, 19, 21, 23], [2, 9, 14, 19, 20, 26], [5, 6, 9, 17, 24, 29], [1, 9, 13, 14, 27, 31],
    [4, 6, 7, 9, 13, 26], [1, 16, 29, 30, 32, 33], [5, 11, 12, 21, 30, 33], [3, 6, 8, 10, 12, 13],
  ];
  const balanced = real.filter((c) => isBalanced(c, game)).length;
  assert.ok(balanced >= 8, `solo ${balanced} de ${real.length} sorteos reales pasan el filtro`);
});

test('el filtro de equilibrio, con fijos imposibles, devuelve algo en vez de colgarse', () => {
  const rng = seededRng(15);
  const combo = generateCombination('AZAR', stats, game, rng, { fijos: [1, 2, 3], equilibrada: true });
  assert.equal(combo.length, 6);
  assert.ok(combo.includes(1) && combo.includes(2) && combo.includes(3));
});

test('generateBatch devuelve N combinaciones distintas por estrategia', () => {
  const { estrategias } = generateBatch(stats, game, seededRng(16), { cantidad: 5 });
  assert.equal(estrategias.length, STRATEGY_CODES.length);
  for (const s of estrategias) {
    assert.equal(s.combinaciones.length, 5, `${s.codigo} debe dar 5`);
    assert.equal(new Set(s.combinaciones.map((c) => c.join('-'))).size, 5, `${s.codigo} repitió una combinación`);
    assert.deepEqual(s.numeros, s.combinaciones[0]);
  }
});

/* ------------------------------------------------------------------ probabilidades */

test('combinatoria: C(33,6) = 1.107.568', () => {
  assert.equal(choose(33, 6), 1107568);
  assert.equal(choose(5, 0), 1);
  assert.equal(choose(5, 6), 0);
});

test('tabla de probabilidades: coincide con valores conocidos y suma 1', () => {
  const odds = prizeOdds(game);
  assert.equal(odds.combinacionesPosibles, 1107568);
  assert.equal(odds.filas[0].aciertos, 6);
  assert.equal(odds.filas[0].unoEn, 1107568);
  assert.equal(odds.filas[1].unoEn, Math.round(1107568 / 162)); // 5 aciertos: C(6,5)*C(27,1) = 162 formas
  const total = odds.filas.reduce((acc, f) => acc + f.probabilidad, 0);
  assert.ok(Math.abs(total - 1) < 1e-12, `suma ${total}`);
  assert.equal(odds.aciertosEsperados, 1.091);
});

test('hipergeométrica: casos límite', () => {
  assert.equal(hypergeometric(33, 6, 6, 7), 0);
  assert.ok(Math.abs(hypergeometric(33, 33, 6, 6) - 1) < 1e-12);
});

/* ------------------------------------------------------------------ cobertura (wheel) */

function allSubsets(items, size) {
  const out = [];
  const cur = [];
  (function walk(start) {
    if (cur.length === size) return void out.push([...cur]);
    for (let i = start; i < items.length; i += 1) {
      cur.push(items[i]);
      walk(i + 1);
      cur.pop();
    }
  })(0);
  return out;
}

test('cobertura: cada subconjunto de `garantia` números del grupo queda cubierto por algún boleto', () => {
  for (const [group, garantia] of [[[3, 8, 12, 15, 20, 25, 27, 31], 3], [[1, 5, 9, 13, 17, 21, 25, 29, 33], 3], [[2, 6, 10, 14, 18, 22, 26, 30, 32], 4]]) {
    const wheel = buildWheel(group, game, garantia);
    for (const ticket of wheel.combinaciones) {
      assert.equal(ticket.length, 6);
      assert.ok(ticket.every((n) => group.includes(n)), 'un boleto usa un número fuera del grupo');
    }
    for (const subset of allSubsets(group, garantia)) {
      const covered = wheel.combinaciones.some((t) => subset.every((n) => t.includes(n)));
      assert.ok(covered, `el subconjunto ${subset} no está cubierto (grupo de ${group.length}, garantía ${garantia})`);
    }
    assert.ok(wheel.totalBoletos <= choose(group.length, 6), 'no puede necesitar más boletos que todas las combinaciones');
  }
});

test('cobertura: la garantía se cumple contra TODOS los sorteos posibles de ese grupo (comprobación exhaustiva)', () => {
  const group = [3, 8, 12, 15, 20, 25, 27, 31];
  const garantia = 3;
  const wheel = buildWheel(group, game, garantia);
  // Para cada forma en que 6 números sorteados contengan >= 3 del grupo, algún boleto debe tener >= 3 aciertos.
  const others = Array.from({ length: 33 }, (_, i) => i + 1).filter((n) => !group.includes(n));
  let checked = 0;
  for (const fromGroup of allSubsets(group, 3)) {
    for (const rest of allSubsets(others, 3).slice(0, 40)) {
      const draw = [...fromGroup, ...rest];
      const best = Math.max(...wheel.combinaciones.map((t) => countHits(t, draw)));
      assert.ok(best >= 3, `sorteo ${draw} no queda cubierto`);
      checked += 1;
    }
  }
  assert.ok(checked > 1000);
});

test('cobertura: probabilidad de activación coherente y validaciones', () => {
  const wheel = buildWheel([3, 8, 12, 15, 20, 25, 27, 31, 33], game, 3);
  assert.ok(wheel.probabilidadActivacion > 0 && wheel.probabilidadActivacion < 1);
  assert.throws(() => buildWheel([1, 2, 3, 4, 5, 6], game, 3), /más de 6/);
  assert.throws(() => buildWheel(Array.from({ length: 13 }, (_, i) => i + 1), game, 3), /más de 12/);
  assert.throws(() => buildWheel([1, 2, 3, 4, 5, 6, 7], game, 1), /entre 2 y 5/);
  assert.throws(() => buildWheel([1, 2, 3, 4, 5, 6, 7], game, 6), /entre 2 y 5/);
});

/* ------------------------------------------------------------------ simulación */

test('simulateCombination cuenta los aciertos por sorteo y resume', () => {
  const result = simulateCombination([8, 11, 15, 18, 19, 29], history, 1.09);
  assert.equal(result.sorteos, 4);
  assert.equal(result.maximo, 6);
  assert.equal(result.distribucion[6], 1);
  assert.deepEqual(result.mejores, [{ fecha: '2026-07-15', aciertos: 6 }]);
  assert.equal(result.esperadoPorAzar, 1.09);
  assert.equal(simulateCombination([1, 2, 3, 4, 5, 6], [], 1.09).promedio, null);
});

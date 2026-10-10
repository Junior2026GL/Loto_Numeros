// Cálculo de estadísticas sobre el historial. Son funciones puras (sin base de datos),
// pensadas para poder probarlas con datos de ejemplo.
//
// IMPORTANTE: son estadísticas DESCRIPTIVAS del pasado. Cada sorteo es independiente:
// que un número "lleve tiempo sin salir" no hace más probable que salga.

import { uniformityTest } from './chi-square.js';

const HOT_COUNT = 8;
const TOP_FREQUENT = 10;
const TOP_COLD = 5;
const TOP_OVERDUE = 8;
const TOP_PAIRS = 12;

const DEFAULT_WEIGHTS = { frecuencia: 50, atraso: 35, caliente: 15 };

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const range = (min, max) => Array.from({ length: max - min + 1 }, (_, i) => min + i);

function normalizeWeights(weights = {}) {
  const w = {
    frecuencia: Number(weights.frecuencia),
    atraso: Number(weights.atraso),
    caliente: Number(weights.caliente),
  };
  const valid = Object.values(w).every((v) => Number.isFinite(v) && v >= 0) && w.frecuencia + w.atraso + w.caliente > 0;
  const source = valid ? w : DEFAULT_WEIGHTS;
  const sum = source.frecuencia + source.atraso + source.caliente;
  return {
    frecuencia: source.frecuencia / sum,
    atraso: source.atraso / sum,
    caliente: source.caliente / sum,
  };
}

/**
 * @param draws  Lista de sorteos ordenada del MÁS RECIENTE al más antiguo: [{ fecha, numeros: [..] }]
 * @param game   { cantidad_numeros, numero_min, numero_max }
 * @param config { ventanaCalientes, pesos: { frecuencia, atraso, caliente } }
 */
export function computeStats(draws, game, config = {}) {
  const pick = game.cantidad_numeros;
  const numbers = range(game.numero_min, game.numero_max);
  const total = draws.length;
  const ventana = Math.max(1, Number(config.ventanaCalientes) || 5);
  const weights = normalizeWeights(config.pesos);

  const times = new Map(numbers.map((n) => [n, 0]));
  const lastIndex = new Map(); // cuántos sorteos atrás salió por última vez (0 = en el más reciente)
  const lastDate = new Map();
  const hotCount = new Map();
  const pairs = new Map();
  const parity = Array(pick + 1).fill(0);
  let sumTotal = 0;
  let sumMin = null;
  let sumMax = null;

  draws.forEach((draw, index) => {
    const sorted = [...draw.numeros].sort((a, b) => a - b);
    let evens = 0;
    let sum = 0;

    sorted.forEach((n, i) => {
      times.set(n, (times.get(n) || 0) + 1);
      if (!lastIndex.has(n)) {
        lastIndex.set(n, index);
        lastDate.set(n, draw.fecha);
      }
      if (index < ventana) hotCount.set(n, (hotCount.get(n) || 0) + 1);
      if (n % 2 === 0) evens += 1;
      sum += n;

      for (let j = i + 1; j < sorted.length; j += 1) {
        const key = `${n}-${sorted[j]}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    });

    parity[evens] = (parity[evens] || 0) + 1;
    sumTotal += sum;
    sumMin = sumMin === null ? sum : Math.min(sumMin, sum);
    sumMax = sumMax === null ? sum : Math.max(sumMax, sum);
  });

  const hot = new Set(
    [...hotCount.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, HOT_COUNT)
      .map(([n]) => n)
  );

  const maxTimes = Math.max(0, ...times.values());

  // Índice de atraso = sorteos sin salir / promedio de sorteos entre apariciones.
  const overdue = new Map();
  for (const n of numbers) {
    const gap = lastIndex.has(n) ? lastIndex.get(n) : total;
    const avgBetween = times.get(n) > 0 ? total / times.get(n) : total;
    overdue.set(n, avgBetween > 0 ? round(gap / avgBetween) : 0);
  }
  const maxOverdue = Math.max(0, ...overdue.values()) || 1;

  const frecuencia = numbers.map((n) => {
    const normFrec = maxTimes > 0 ? (times.get(n) / maxTimes) * 100 : 0;
    const normAtraso = (overdue.get(n) / maxOverdue) * 100;
    const normCaliente = hot.has(n) ? 100 : 0;

    return {
      numero: n,
      veces: times.get(n),
      porcentaje: total > 0 ? round((times.get(n) / total) * 100, 1) : 0,
      ultimaFecha: lastDate.get(n) || null,
      sorteosSinSalir: lastIndex.has(n) ? lastIndex.get(n) : total,
      indiceAtraso: overdue.get(n),
      caliente: hot.has(n),
      score: round(normFrec * weights.frecuencia + normAtraso * weights.atraso + normCaliente * weights.caliente, 1),
    };
  });

  const byNumber = (a, b) => a.numero - b.numero;

  return {
    totalSorteos: total,
    // Cuántas veces "debería" salir cada número si todos fueran igual de probables.
    esperadoPorNumero: total > 0 ? round((total * pick) / numbers.length, 1) : 0,
    frecuencia,
    // ¿Las diferencias entre números son compatibles con el azar? (chi-cuadrado, p >= 0.05 = sí)
    uniformidad: total > 0
      ? uniformityTest(frecuencia.map((f) => f.veces), (total * pick) / numbers.length)
      : null,
    masFrecuentes: [...frecuencia].sort((a, b) => b.veces - a.veces || byNumber(a, b)).slice(0, TOP_FREQUENT),
    masFrios: [...frecuencia].sort((a, b) => a.veces - b.veces || byNumber(a, b)).slice(0, TOP_COLD),
    calientes: frecuencia.filter((f) => f.caliente).map((f) => f.numero),
    atrasados: [...frecuencia].sort((a, b) => b.indiceAtraso - a.indiceAtraso || byNumber(a, b)).slice(0, TOP_OVERDUE),
    paresFrecuentes: [...pairs.entries()]
      .map(([key, veces]) => {
        const [a, b] = key.split('-').map(Number);
        return { a, b, veces };
      })
      .sort((x, y) => y.veces - x.veces || x.a - y.a || x.b - y.b)
      .slice(0, TOP_PAIRS),
    mejorCombinacion: [...frecuencia]
      .sort((a, b) => b.score - a.score || byNumber(a, b))
      .slice(0, pick)
      .map((f) => f.numero)
      .sort((a, b) => a - b),
    paridad: parity.map((sorteos, pares) => ({ pares, impares: pick - pares, sorteos })),
    suma: total > 0
      ? { promedio: round(sumTotal / total, 1), minimo: sumMin, maximo: sumMax }
      : { promedio: 0, minimo: 0, maximo: 0 },
  };
}

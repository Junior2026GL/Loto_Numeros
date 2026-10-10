import { computeStats } from '../stats/stats.calculator.js';
import { STRATEGIES, countHits, generateCombination } from './combos.generator.js';

// Prueba retrospectiva: para cada sorteo pasado se generan combinaciones usando SOLO lo que se sabía
// antes de ese sorteo y se cuentan los aciertos contra el resultado real. Así se mide, con datos,
// si alguna estrategia hace algo mejor que el azar.

/** Generador pseudoaleatorio con semilla (mulberry32): mismo historial, mismo resultado. */
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value, decimals = 3) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/**
 * @param draws  Del más reciente al más antiguo: [{ fecha, numeros }]
 * @param game   { cantidad_numeros, numero_min, numero_max }
 * @param config { ventanaCalientes, pesos } igual que computeStats
 * @param options { combinaciones: por sorteo y estrategia, minimo: sorteos de historia previa necesarios, seed }
 */
export function backtest(draws, game, config = {}, { combinaciones = 50, minimo = 20, seed = 2026 } = {}) {
  const rng = seededRng(seed);
  const pick = game.cantidad_numeros;
  const poolSize = game.numero_max - game.numero_min + 1;
  const expectedByChance = (pick * pick) / poolSize;

  const tally = new Map(STRATEGIES.map((s) => [s.codigo, { sum: 0, sumSquares: 0, max: 0, n: 0 }]));
  let evaluatedDraws = 0;

  // draws[i] es el sorteo a "predecir"; la historia disponible son los más antiguos (i + 1 en adelante).
  for (let i = 0; i + minimo < draws.length; i += 1) {
    const history = draws.slice(i + 1);
    const stats = computeStats(history, game, config);
    evaluatedDraws += 1;

    for (const strategy of STRATEGIES) {
      const entry = tally.get(strategy.codigo);
      for (let k = 0; k < combinaciones; k += 1) {
        const hits = countHits(generateCombination(strategy.codigo, stats, game, rng), draws[i].numeros);
        entry.sum += hits;
        entry.sumSquares += hits * hits;
        entry.max = Math.max(entry.max, hits);
        entry.n += 1;
      }
    }
  }

  const estrategias = STRATEGIES.map((strategy) => {
    const { sum, sumSquares, max, n } = tally.get(strategy.codigo);
    if (n === 0) return { codigo: strategy.codigo, nombre: strategy.nombre, muestras: 0, promedio: null };

    const mean = sum / n;
    const variance = Math.max(0, sumSquares / n - mean * mean);
    // Las combinaciones de un mismo sorteo comparten resultado, así que el margen se calcula con los
    // sorteos evaluados (no con todas las combinaciones) para no aparentar más certeza de la real.
    const margin = 1.96 * Math.sqrt(variance / evaluatedDraws);

    return {
      codigo: strategy.codigo,
      nombre: strategy.nombre,
      muestras: n,
      promedio: round(mean),
      maximo: max,
      margenError: round(margin),
      diferenciaVsAzar: round(mean - expectedByChance),
      distinguibleDelAzar: Math.abs(mean - expectedByChance) > margin,
    };
  });

  return {
    sorteosEvaluados: evaluatedDraws,
    combinacionesPorSorteo: combinaciones,
    promedioPorAzar: round(expectedByChance, 2),
    estrategias,
  };
}

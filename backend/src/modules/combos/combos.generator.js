import { randomInt } from 'node:crypto';

// Generador de combinaciones a partir de las estadísticas del historial.
// Son funciones puras: el azar entra por el parámetro `rng` para poder probarlas.
//
// IMPORTANTE: ninguna estrategia mejora la probabilidad de ganar. Todas las combinaciones
// de números tienen exactamente la misma probabilidad en un sorteo justo.

const defaultRng = () => randomInt(0, 1_000_000_000) / 1_000_000_000;

export const STRATEGIES = [
  { codigo: 'SCORE', nombre: 'Puntaje', descripcion: 'Favorece los números con mejor puntaje combinado de frecuencia, atraso y calientes.' },
  { codigo: 'CALIENTES', nombre: 'Calientes', descripcion: 'Usa los números que más se repitieron en los sorteos más recientes.' },
  { codigo: 'ATRASADOS', nombre: 'Atrasados', descripcion: 'Favorece los que llevan más sorteos sin salir respecto a su promedio.' },
  { codigo: 'PARES', nombre: 'Parejas', descripcion: 'Parte de las parejas de números que más coincidieron en el pasado.' },
  { codigo: 'BALANCEADA', nombre: 'Balanceada', descripcion: 'Mezcla: 2 por puntaje, 2 atrasados, 1 caliente y 1 por frecuencia.' },
  { codigo: 'FRECUENCIA', nombre: 'Por frecuencia', descripcion: 'Al azar, pero los más frecuentes tienen más peso.' },
  { codigo: 'AZAR', nombre: 'Azar puro', descripcion: 'Totalmente aleatoria. Es la referencia con la que comparar las demás.' },
];

export const STRATEGY_CODES = STRATEGIES.map((s) => s.codigo);

/** Elige `count` números distintos de `candidates`, con probabilidad proporcional a su peso. */
function pick(candidates, weightOf, count, taken, rng) {
  const pool = candidates.filter((n) => !taken.has(n));
  const chosen = [];

  while (chosen.length < count && pool.length > 0) {
    const weights = pool.map((n) => Math.max(0, weightOf(n)));
    const total = weights.reduce((a, b) => a + b, 0);

    let index = pool.length - 1;
    if (total > 0) {
      let target = rng() * total;
      for (let i = 0; i < pool.length; i += 1) {
        target -= weights[i];
        if (target < 0) {
          index = i;
          break;
        }
      }
    } else {
      index = Math.floor(rng() * pool.length);
    }

    const [number] = pool.splice(index, 1);
    chosen.push(number);
    taken.add(number);
  }
  return chosen;
}

const sortNumbers = (numbers) => [...numbers].sort((a, b) => a - b);

/**
 * @param stats  Resultado de computeStats (frecuencia, calientes, paresFrecuentes...).
 * @param game   { cantidad_numeros, numero_min, numero_max }
 */
export function generateCombination(strategy, stats, game, rng = defaultRng) {
  const pickCount = game.cantidad_numeros;
  const all = Array.from({ length: game.numero_max - game.numero_min + 1 }, (_, i) => game.numero_min + i);
  const byNumber = new Map(stats.frecuencia.map((f) => [f.numero, f]));
  const field = (n, key) => byNumber.get(n)?.[key] ?? 0;

  const frequencyWeight = (n) => field(n, 'veces') + 1;
  const taken = new Set();

  // Rellena lo que falte con números ponderados por frecuencia (siempre se llega a `pickCount`).
  const fill = () => pick(all, frequencyWeight, pickCount - taken.size, taken, rng);

  switch (strategy) {
    case 'SCORE':
      pick(all, (n) => field(n, 'score') + 1, pickCount, taken, rng);
      break;

    case 'CALIENTES':
      pick(stats.calientes, () => 1, pickCount, taken, rng);
      fill();
      break;

    case 'ATRASADOS':
      pick(all, (n) => field(n, 'indiceAtraso') ** 2 + 0.1, pickCount, taken, rng);
      break;

    case 'PARES': {
      const pairs = [...stats.paresFrecuentes];
      while (taken.size < pickCount && pairs.length > 0) {
        const total = pairs.reduce((acc, p) => acc + p.veces, 0);
        let target = rng() * total;
        let index = pairs.length - 1;
        for (let i = 0; i < pairs.length; i += 1) {
          target -= pairs[i].veces;
          if (target < 0) {
            index = i;
            break;
          }
        }
        const [pair] = pairs.splice(index, 1);
        for (const n of [pair.a, pair.b]) {
          if (taken.size < pickCount) taken.add(n);
        }
      }
      fill();
      break;
    }

    case 'BALANCEADA': {
      const topBy = (key, size) => [...all]
        .sort((a, b) => field(b, key) - field(a, key) || a - b)
        .slice(0, size);
      pick(topBy('score', 6), () => 1, 2, taken, rng);
      pick(topBy('indiceAtraso', 6), () => 1, 2, taken, rng);
      pick(stats.calientes, () => 1, 1, taken, rng);
      fill();
      break;
    }

    case 'FRECUENCIA':
      pick(all, frequencyWeight, pickCount, taken, rng);
      break;

    case 'AZAR':
      pick(all, () => 1, pickCount, taken, rng);
      break;

    default:
      throw new Error(`Estrategia desconocida: ${strategy}`);
  }

  return sortNumbers(taken);
}

export function generateAll(stats, game, rng = defaultRng) {
  return STRATEGIES.map((strategy) => ({
    ...strategy,
    numeros: generateCombination(strategy.codigo, stats, game, rng),
  }));
}

/** Cuántos números de la combinación están en el resultado del sorteo. */
export function countHits(combination, result) {
  const set = new Set(result);
  return combination.filter((n) => set.has(n)).length;
}

import { randomInt } from 'node:crypto';

// Generador de combinaciones a partir de las estadísticas del historial.
// Son funciones puras: el azar entra por el parámetro `rng` para poder probarlas.
//
// IMPORTANTE: ninguna estrategia ni filtro mejora la probabilidad de ganar. Todas las combinaciones
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

const MAX_BALANCE_ATTEMPTS = 300;
const MAX_VARIANT_ATTEMPTS = 25;

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
 * ¿Es una combinación "equilibrada"? Es decir, que se parezca a un sorteo típico y no a un patrón raro:
 * mezcla de pares e impares, sin rachas largas de consecutivos, sin progresión aritmética y con una suma
 * cercana a la esperada. No cambia la probabilidad de salir; solo evita combinaciones que mucha gente juega.
 */
export function isBalanced(numbers, game) {
  const sorted = sortNumbers(numbers);
  const pickCount = sorted.length;
  const poolSize = game.numero_max - game.numero_min + 1;

  const evens = sorted.filter((n) => n % 2 === 0).length;
  const minEvens = Math.ceil(pickCount / 3);
  if (evens < minEvens || evens > pickCount - minEvens) return false;

  let run = 1;
  let longest = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  if (longest > 2) return false;

  if (pickCount >= 4) {
    const step = sorted[1] - sorted[0];
    if (sorted.every((n, i) => i === 0 || n - sorted[i - 1] === step)) return false;
  }

  // Suma esperada y desviación al elegir `pickCount` números distintos de un rango uniforme.
  const mean = (pickCount * (game.numero_min + game.numero_max)) / 2;
  const populationVariance = (poolSize ** 2 - 1) / 12;
  const sd = Math.sqrt(pickCount * populationVariance * ((poolSize - pickCount) / (poolSize - 1)));
  const sum = sorted.reduce((a, b) => a + b, 0);
  return Math.abs(sum - mean) <= 1.5 * sd;
}

function buildOne(strategy, stats, game, rng, { fijos = [], excluidos = [] }) {
  const pickCount = game.cantidad_numeros;
  const all = Array.from({ length: game.numero_max - game.numero_min + 1 }, (_, i) => game.numero_min + i);
  const byNumber = new Map(stats.frecuencia.map((f) => [f.numero, f]));
  const field = (n, key) => byNumber.get(n)?.[key] ?? 0;

  const blocked = new Set(excluidos);
  const taken = new Set(fijos);
  const need = () => pickCount - taken.size;

  const frequencyWeight = (n) => field(n, 'veces') + 1;
  // Elige entre los candidatos permitidos (nunca los excluidos) hasta completar la combinación.
  const choose = (candidates, weightOf, count = need()) =>
    pick(candidates.filter((n) => !blocked.has(n)), weightOf, Math.max(0, count), taken, rng);
  // Rellena lo que falte con números ponderados por frecuencia (siempre se llega a `pickCount`).
  const fill = () => choose(all, frequencyWeight);

  switch (strategy) {
    case 'SCORE':
      choose(all, (n) => field(n, 'score') + 1);
      break;

    case 'CALIENTES':
      choose(stats.calientes, () => 1);
      fill();
      break;

    case 'ATRASADOS':
      choose(all, (n) => field(n, 'indiceAtraso') ** 2 + 0.1);
      break;

    case 'PARES': {
      const pairs = stats.paresFrecuentes.filter((p) => !blocked.has(p.a) && !blocked.has(p.b));
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
      const topBy = (key, size) => all
        .filter((n) => !blocked.has(n))
        .sort((a, b) => field(b, key) - field(a, key) || a - b)
        .slice(0, size);
      choose(topBy('score', 6), () => 1, Math.min(2, need()));
      choose(topBy('indiceAtraso', 6), () => 1, Math.min(2, need()));
      choose(stats.calientes, () => 1, Math.min(1, need()));
      fill();
      break;
    }

    case 'FRECUENCIA':
      choose(all, frequencyWeight);
      break;

    case 'AZAR':
      choose(all, () => 1);
      break;

    default:
      throw new Error(`Estrategia desconocida: ${strategy}`);
  }

  return sortNumbers(taken);
}

/**
 * @param strategy  Código de estrategia (ver STRATEGIES).
 * @param stats     Resultado de computeStats (frecuencia, calientes, paresFrecuentes...).
 * @param game      { cantidad_numeros, numero_min, numero_max }
 * @param options   { fijos: [..] números obligatorios, excluidos: [..] números prohibidos, equilibrada: bool }
 */
export function generateCombination(strategy, stats, game, rng = defaultRng, options = {}) {
  if (!options.equilibrada) return buildOne(strategy, stats, game, rng, options);

  // Con el filtro activado se reintenta. Si la estrategia casi siempre da lo mismo (por ejemplo, Parejas con
  // poco historial) y no logra una equilibrada, se completa con una versión ponderada y, al final, con azar puro.
  const chain = [strategy, 'FRECUENCIA', 'AZAR'].filter((code, i, all) => all.indexOf(code) === i);
  let last = null;
  for (const code of chain) {
    for (let i = 0; i < MAX_BALANCE_ATTEMPTS; i += 1) {
      last = buildOne(code, stats, game, rng, options);
      if (isBalanced(last, game)) return last;
    }
  }
  return last; // No se logró (por ejemplo, por los números fijos): se devuelve la última.
}

export function generateAll(stats, game, rng = defaultRng, options = {}) {
  return STRATEGIES.map((strategy) => ({
    ...strategy,
    numeros: generateCombination(strategy.codigo, stats, game, rng, options),
  }));
}

/**
 * Genera `cantidad` combinaciones distintas por estrategia.
 * Devuelve también cuántas no pudieron cumplir el filtro de equilibrio (si estaba activado).
 */
export function generateBatch(stats, game, rng = defaultRng, options = {}) {
  const cantidad = Math.max(1, options.cantidad || 1);
  let sinEquilibrio = 0;

  const estrategias = STRATEGIES.map((strategy) => {
    const seen = new Set();
    const combinaciones = [];
    let guard = 0;

    while (combinaciones.length < cantidad && guard < cantidad * MAX_VARIANT_ATTEMPTS) {
      guard += 1;
      const numbers = generateCombination(strategy.codigo, stats, game, rng, options);
      const key = numbers.join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      combinaciones.push(numbers);
      if (options.equilibrada && !isBalanced(numbers, game)) sinEquilibrio += 1;
    }

    return { ...strategy, numeros: combinaciones[0], combinaciones };
  });

  return { estrategias, sinEquilibrio };
}

/** Cuántos números de la combinación están en el resultado del sorteo. */
export function countHits(combination, result) {
  const set = new Set(result);
  return combination.filter((n) => set.has(n)).length;
}

import { choose, hypergeometric } from './combos.odds.js';

// Sistema de cobertura ("wheel"): a partir de un grupo de números elegidos, arma un conjunto de
// combinaciones tal que, si en el sorteo salen al menos `garantia` números de tu grupo, al menos una de
// tus combinaciones tendrá `garantia` aciertos o más.
//
// NO aumenta la probabilidad de que tus números salgan: solo organiza cómo repartirlos en boletos.
// Lo que sí hace es cambiar la forma de los resultados (más boletos con premios menores seguros si se da el caso).

const MAX_GROUP = 12;
const MAX_TICKETS = 200;

function subsets(items, size) {
  const out = [];
  const current = [];
  (function walk(start) {
    if (current.length === size) {
      out.push([...current]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      current.push(items[i]);
      walk(i + 1);
      current.pop();
    }
  })(0);
  return out;
}

/**
 * @param grupo     Números elegidos (entre pick+1 y 12).
 * @param game      { cantidad_numeros, numero_min, numero_max }
 * @param garantia  Aciertos que se quieren asegurar (entre 2 y pick-1).
 */
export function buildWheel(grupo, game, garantia) {
  const pick = game.cantidad_numeros;
  const population = game.numero_max - game.numero_min + 1;
  const numbers = [...new Set(grupo)].sort((a, b) => a - b);

  if (numbers.length <= pick) throw new Error(`El grupo debe tener más de ${pick} números`);
  if (numbers.length > MAX_GROUP) throw new Error(`El grupo no puede tener más de ${MAX_GROUP} números`);
  if (garantia < 2 || garantia > pick - 1) throw new Error(`La garantía debe estar entre 2 y ${pick - 1}`);

  // Todos los subconjuntos de `garantia` números del grupo deben quedar contenidos en algún boleto.
  const targets = subsets(numbers, garantia);
  const targetId = new Map(targets.map((t, i) => [t.join(','), i]));

  const candidates = subsets(numbers, pick).map((ticket) => ({
    ticket,
    covers: subsets(ticket, garantia).map((t) => targetId.get(t.join(','))),
  }));

  const covered = new Array(targets.length).fill(false);
  let remaining = targets.length;
  const tickets = [];

  // Algoritmo voraz: en cada paso se elige el boleto que cubre más subconjuntos todavía sin cubrir.
  while (remaining > 0) {
    let best = null;
    let bestGain = -1;
    for (const candidate of candidates) {
      const gain = candidate.covers.reduce((acc, id) => acc + (covered[id] ? 0 : 1), 0);
      if (gain > bestGain) {
        bestGain = gain;
        best = candidate;
      }
    }
    for (const id of best.covers) {
      if (!covered[id]) {
        covered[id] = true;
        remaining -= 1;
      }
    }
    tickets.push(best.ticket);
    if (tickets.length > MAX_TICKETS) throw new Error('Esa combinación de grupo y garantía necesita demasiados boletos');
  }

  // Probabilidad de que la garantía "se active": que salgan al menos `garantia` de tus números en el sorteo.
  let activation = 0;
  for (let x = garantia; x <= pick; x += 1) activation += hypergeometric(population, numbers.length, pick, x);

  return {
    grupo: numbers,
    garantia,
    combinaciones: tickets.sort((a, b) => a.join(',').localeCompare(b.join(','), undefined, { numeric: true })),
    totalBoletos: tickets.length,
    combinacionesPosibles: choose(numbers.length, pick),
    probabilidadActivacion: activation,
  };
}

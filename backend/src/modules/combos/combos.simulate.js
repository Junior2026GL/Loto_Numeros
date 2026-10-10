import { countHits } from './combos.generator.js';

/**
 * ¿Cómo le habría ido a una combinación en sorteos pasados? Cuenta los aciertos que habría tenido en cada uno.
 * Es solo una mirada al pasado: no dice nada sobre el próximo sorteo.
 *
 * @param numbers  La combinación a probar.
 * @param draws    Sorteos del más reciente al más antiguo: [{ fecha, numeros }]
 * @param expected Aciertos esperados por azar (para comparar).
 */
export function simulateCombination(numbers, draws, expected) {
  const distribution = {};
  let sum = 0;
  let best = 0;
  const results = draws.map((draw) => {
    const hits = countHits(numbers, draw.numeros);
    distribution[hits] = (distribution[hits] || 0) + 1;
    sum += hits;
    best = Math.max(best, hits);
    return { fecha: draw.fecha, aciertos: hits };
  });

  return {
    sorteos: draws.length,
    promedio: draws.length ? Math.round((sum / draws.length) * 1000) / 1000 : null,
    esperadoPorAzar: expected,
    maximo: best,
    distribucion: distribution,
    mejores: results
      .filter((r) => r.aciertos === best && best > 0)
      .slice(0, 5),
  };
}

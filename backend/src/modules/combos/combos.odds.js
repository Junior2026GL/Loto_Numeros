// Probabilidades exactas de un juego tipo "elige K números de N" (distribución hipergeométrica).

/** Número combinatorio C(n, k). Exacto mientras el resultado quepa en un double (C(33,6) = 1.107.568). */
export function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= Math.min(k, n - k); i += 1) {
    result = (result * (n - i + 1)) / i;
  }
  return Math.round(result);
}

/**
 * Probabilidad de que, de `drawn` números sorteados de una población de `population`, exactamente `k`
 * estén entre tus `mine` números.
 */
export function hypergeometric(population, mine, drawn, k) {
  const total = choose(population, drawn);
  return total === 0 ? 0 : (choose(mine, k) * choose(population - mine, drawn - k)) / total;
}

/** Probabilidad de acertar exactamente k números con UNA combinación de `pick` números. */
export function prizeOdds(game) {
  const population = game.numero_max - game.numero_min + 1;
  const pick = game.cantidad_numeros;

  const rows = [];
  for (let hits = pick; hits >= 0; hits -= 1) {
    const probability = hypergeometric(population, pick, pick, hits);
    rows.push({ aciertos: hits, probabilidad: probability, unoEn: probability > 0 ? Math.round(1 / probability) : null });
  }

  return {
    combinacionesPosibles: choose(population, pick),
    aciertosEsperados: Math.round(((pick * pick) / population) * 1000) / 1000,
    filas: rows,
  };
}

// Prueba chi-cuadrado de bondad de ajuste: ¿las frecuencias observadas son compatibles con que
// todos los números tengan la misma probabilidad?

const EPSILON = 1e-14;
const MAX_ITERATIONS = 500;

/** log Gamma(x) por la aproximación de Lanczos. */
function logGamma(x) {
  const c = [
    76.1800917294715, -86.5053203294168, 24.0140982408309,
    -1.23173957245016, 0.120865097386618e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let series = 1.000000000190015;
  for (const coefficient of c) {
    y += 1;
    series += coefficient / y;
  }
  return -tmp + Math.log((Math.sqrt(2 * Math.PI) * series) / x);
}

/** Función gamma incompleta regularizada superior Q(a, x). */
function gammaQ(a, x) {
  if (x <= 0) return 1;

  if (x < a + 1) {
    // Serie para P(a, x); Q = 1 - P.
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n <= MAX_ITERATIONS; n += 1) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * EPSILON) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }

  // Fracción continua (Lentz) para Q(a, x).
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= MAX_ITERATIONS; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPSILON) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** p-valor de un chi-cuadrado `statistic` con `df` grados de libertad. */
export function chiSquarePValue(statistic, df) {
  return Math.min(1, Math.max(0, gammaQ(df / 2, statistic / 2)));
}

/**
 * @param observed  veces que salió cada número (en cualquier orden)
 * @param expected  veces que se esperaba cada uno si todos fueran igual de probables
 */
export function uniformityTest(observed, expected) {
  if (!observed.length || !(expected > 0)) return null;

  const statistic = observed.reduce((acc, o) => acc + (o - expected) ** 2 / expected, 0);
  const df = observed.length - 1;
  return {
    chi2: Math.round(statistic * 100) / 100,
    gradosLibertad: df,
    pValor: Math.round(chiSquarePValue(statistic, df) * 1000) / 1000,
  };
}

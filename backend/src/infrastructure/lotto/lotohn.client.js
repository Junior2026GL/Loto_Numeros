import { env } from '../../config/env.js';

const RETRY_STATUS = new Set([403, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Reintenta con espera creciente (2 s, 4 s) cuando la fuente rechaza o falla de forma pasajera.
async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://loto.hn/' },
        signal: AbortSignal.timeout(env.lotto.timeoutMs),
      });
    } catch (err) {
      lastError = err; // timeout o error de red: se reintenta
    }

    if (response?.ok) return response;
    if (response) {
      const ray = response.headers.get('cf-ray');
      const server = response.headers.get('server');
      const detalle = [server && `servidor ${server}`, ray && `cf-ray ${ray}`].filter(Boolean).join(', ');
      lastError = new Error(`loto.hn respondió HTTP ${response.status}${detalle ? ` (${detalle})` : ''}`);
      if (!RETRY_STATUS.has(response.status)) throw lastError;
    }
    if (attempt < MAX_ATTEMPTS) await sleep(attempt * 2000);
  }
  throw lastError;
}

/**
 * Consulta el resultado de un sorteo en loto.hn.
 * Devuelve { numeros } si hay resultado, o null si ese día no hay sorteo / aún no se publica.
 * Lanza un Error si la fuente no responde o devuelve algo inesperado.
 */
export async function fetchDrawResult(fecha, cantidadNumeros) {
  const url = `${env.lotto.baseUrl}?fecha=${encodeURIComponent(fecha)}`;

  const response = await fetchWithRetry(url);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('loto.hn devolvió una respuesta que no es JSON');
  }

  // Sin sorteo ese día la API responde una lista vacía.
  if (Array.isArray(data) || !data || data.par1 === undefined) return null;

  const numeros = [];
  for (let i = 1; i <= cantidadNumeros; i += 1) {
    numeros.push(Number(data[`par${i}`]));
  }
  return { numeros };
}

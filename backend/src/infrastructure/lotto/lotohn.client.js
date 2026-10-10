import { env } from '../../config/env.js';

/**
 * Consulta el resultado de un sorteo en loto.hn.
 * Devuelve { numeros } si hay resultado, o null si ese día no hay sorteo / aún no se publica.
 * Lanza un Error si la fuente no responde o devuelve algo inesperado.
 */
export async function fetchDrawResult(fecha, cantidadNumeros) {
  const url = `${env.lotto.baseUrl}?fecha=${encodeURIComponent(fecha)}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://loto.hn/' },
    signal: AbortSignal.timeout(env.lotto.timeoutMs),
  });

  if (!response.ok) throw new Error(`loto.hn respondió HTTP ${response.status}`);

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

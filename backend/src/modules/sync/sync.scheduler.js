import { env } from '../../config/env.js';
import * as repository from './sync.repository.js';
import { runPending } from './sync.service.js';

const CHECK_EVERY_MS = 30 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 60 * 1000;

async function tick() {
  try {
    const result = await runPending({ origen: 'PROGRAMADA' });
    if (result.insertados > 0) {
      console.log(`[sync] ${result.insertados} sorteo(s) nuevo(s) guardado(s)`);
    }
  } catch (error) {
    // 409 = ya había una sincronización en curso; no es un fallo.
    if (error.statusCode !== 409) console.error('[sync] La sincronización programada falló:', error.message);
  }
}

export async function startSyncScheduler() {
  // Cualquier ejecución que quedó "en curso" pertenece a un servidor que ya no existe.
  await repository.failStaleRuns().catch(() => {});

  if (!env.lotto.autoSync) return;

  console.log('[sync] Sincronización automática activada (cada 30 min)');
  setTimeout(tick, FIRST_CHECK_DELAY_MS).unref();
  setInterval(tick, CHECK_EVERY_MS).unref();
}

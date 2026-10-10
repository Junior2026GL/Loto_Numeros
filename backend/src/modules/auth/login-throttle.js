/**
 * Bloqueo temporal por exceso de intentos fallidos de login.
 *
 * Vive en memoria (se reinicia con el servidor) y se limpia solo: las entradas que ya
 * no sirven se descartan, así el mapa no crece sin límite aunque alguien pruebe miles de usuarios.
 * El reloj se inyecta para poder probarlo.
 */
export function createLoginThrottle({
  maxAttempts = 5,
  lockMinutes = 15,
  windowMinutes = 15,
  now = Date.now,
  sweepEveryMs = 60_000,
} = {}) {
  const entries = new Map();
  let lastSweep = now();

  function sweep() {
    const current = now();
    if (current - lastSweep < sweepEveryMs) return;
    lastSweep = current;

    for (const [key, entry] of entries) {
      const lockExpired = !entry.lockedUntil || entry.lockedUntil <= current;
      const windowExpired = current - entry.lastAttempt > windowMinutes * 60_000;
      if (lockExpired && windowExpired) entries.delete(key);
    }
  }

  return {
    /** Minutos restantes de bloqueo, o 0 si puede intentar. */
    minutesLocked(key) {
      sweep();
      const entry = entries.get(key);
      if (!entry?.lockedUntil || entry.lockedUntil <= now()) return 0;
      return Math.ceil((entry.lockedUntil - now()) / 60_000);
    },

    registerFailure(key) {
      sweep();
      const current = now();
      let entry = entries.get(key);

      // Los fallos viejos no se acumulan: solo cuentan los de la ventana reciente.
      if (!entry || current - entry.lastAttempt > windowMinutes * 60_000) {
        entry = { attempts: 0, lockedUntil: null, lastAttempt: current };
      }

      entry.attempts += 1;
      entry.lastAttempt = current;
      if (entry.attempts >= maxAttempts) {
        entry.lockedUntil = current + lockMinutes * 60_000;
        entry.attempts = 0;
      }
      entries.set(key, entry);
    },

    clear(key) {
      entries.delete(key);
    },

    get size() {
      return entries.size;
    },
  };
}

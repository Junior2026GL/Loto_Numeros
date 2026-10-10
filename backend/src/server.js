import { app } from './app.js';
import { env } from './config/env.js';
import { db } from './infrastructure/database/mysql.js';
import { startSyncScheduler } from './modules/sync/sync.scheduler.js';

async function start() {
  try {
    await db.query('SELECT 1');
    console.log('MySQL conectado');

    await startSyncScheduler();

    app.listen(env.port, () => {
      console.log(`Loto Números API ejecutándose en puerto ${env.port}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error);
    process.exit(1);
  }
}

start();

import { app } from './app.js';
import { env } from './config/env.js';
import { db } from './infrastructure/database/mysql.js';

async function start() {
  try {
    await db.query('SELECT 1');
    console.log('MySQL conectado');

    app.listen(env.port, () => {
      console.log(`Loto Números API ejecutándose en puerto ${env.port}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error);
    process.exit(1);
  }
}

start();

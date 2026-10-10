import mysql from 'mysql2/promise';
import { env } from '../../config/env.js';

// Honduras no usa horario de verano: UTC-6 todo el año. Se fija en las dos puntas (las fechas que
// envía Node y la sesión de MySQL) para que NOW(), los TIMESTAMP y los vencimientos coincidan
// sin importar en qué zona horaria esté configurado el servidor.
export const APP_TIME_ZONE = '-06:00';

export const db = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  timezone: APP_TIME_ZONE,
});

db.pool.on('connection', (connection) => {
  connection.query(`SET time_zone = '${APP_TIME_ZONE}'`);
});

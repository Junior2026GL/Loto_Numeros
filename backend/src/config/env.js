import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET debe estar definido en producción (falta variable de entorno)');
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'loto_numeros',
  },

  jwtSecret: process.env.JWT_SECRET || 'cambia-esta-clave',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
};

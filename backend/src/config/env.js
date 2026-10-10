import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';
const DEFAULT_JWT_SECRET = 'cambia-esta-clave';

if (nodeEnv === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === DEFAULT_JWT_SECRET || secret.length < 32) {
    throw new Error('En producción JWT_SECRET debe estar definido, ser distinto del valor de ejemplo y tener al menos 32 caracteres');
  }
  if (!process.env.FRONTEND_URL) {
    throw new Error('En producción FRONTEND_URL debe estar definido (origen permitido por CORS)');
  }
  if (!process.env.DB_PASSWORD) {
    throw new Error('En producción DB_PASSWORD no puede estar vacío');
  }
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // Cuántos proxies hay delante del servidor (nginx = 1). 0 = ninguno: así nadie puede
  // falsear su IP con la cabecera X-Forwarded-For para esquivar los límites de intentos.
  trustProxy: Number(process.env.TRUST_PROXY || 0),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'loto_numeros',
  },

  jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  lotto: {
    baseUrl: process.env.LOTTO_API_URL || 'https://loto.hn/api/resultados_superpremio_por_fecha.php',
    timeoutMs: Number(process.env.LOTTO_TIMEOUT_MS || 10000),
    // Sincronización automática después de cada sorteo. Apagada por defecto.
    autoSync: process.env.SYNC_AUTO === 'true',
  },
};

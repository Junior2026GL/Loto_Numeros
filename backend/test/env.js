// Debe importarse ANTES que cualquier módulo de la app: fija la base de datos de pruebas.
// Las pruebas nunca tocan la base real (loto_numeros).
process.env.DB_NAME = 'loto_numeros_test';
process.env.NODE_ENV = 'test';
process.env.SYNC_AUTO = 'false';
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-automaticas-0123456789';
// Sin SMTP: el código de recuperación se escribe en consola, donde la prueba lo captura.
process.env.SMTP_HOST = '';
// Los límites por IP existen en producción; en pruebas todas las peticiones salen de la misma IP.
process.env.RATE_LIMIT_RECOVERY = '1000';
process.env.RATE_LIMIT_API = '100000';

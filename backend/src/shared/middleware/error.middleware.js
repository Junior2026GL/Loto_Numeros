const isProduction = () => process.env.NODE_ENV === 'production';

// Errores del cliente que lanza el propio Express, con un mensaje que no revela el intérprete.
const CLIENT_ERRORS = {
  'entity.parse.failed': 'El cuerpo de la solicitud no es un JSON válido',
  'entity.too.large': 'La solicitud es demasiado grande',
};

export function notFound(req, res) {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const isServerError = statusCode >= 500;

  // Solo los fallos del servidor se registran con detalle: un 401 o un dato inválido es normal.
  if (isServerError) console.error(err);

  // En producción nunca se muestran al usuario los mensajes internos (SQL, rutas, etc.).
  const message = CLIENT_ERRORS[err.type]
    || (isServerError && isProduction() ? 'Error interno del servidor' : err.message)
    || 'Error interno del servidor';

  res.status(statusCode).json({
    ok: false,
    message,
    ...(err.details ? { details: err.details } : {}),
  });
}

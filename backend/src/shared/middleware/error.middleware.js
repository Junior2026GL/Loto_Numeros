export function notFound(req, res) {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  console.error(err);

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    ok: false,
    message: err.message || 'Error interno del servidor',
    ...(err.details ? { details: err.details } : {}),
    ...(process.env.NODE_ENV !== 'production' && err.meta ? { meta: err.meta } : {}),
  });
}

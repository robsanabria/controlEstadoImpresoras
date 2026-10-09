const crypto = require('node:crypto');

// ============================================================================
// Manejo de errores ESTÁNDAR.
// - Al cliente: { mensaje, id }. Nunca err.message de mssql (revela tablas).
// - Al log: id + stack completo, para cruzar con lo que ve el usuario.
// - 404 de API en JSON (el SPA fallback solo aplica a rutas no-/api).
//
// Uso en index.js, DESPUÉS de todas las rutas:
//   const { noEncontrado, manejarError, asyncHandler } = require('./middlewares/errores');
//   app.use('/api', noEncontrado);
//   app.use(manejarError);
// En controllers: router.get('/x', asyncHandler(async (req, res) => { ... }))
// ============================================================================

class ErrorHttp extends Error {
  constructor(status, mensaje, detalle) {
    super(mensaje);
    this.status = status;
    this.detalle = detalle; // solo va al log
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function noEncontrado(req, res) {
  res.status(404).json({ mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function manejarError(err, req, res, next) {
  const id = crypto.randomBytes(4).toString('hex');
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  const quien = req.user?.Email || 'anon';

  console.error(`[Error ${id}] ${status} ${req.method} ${req.originalUrl} (${quien}):`, err.detalle || err.message);
  if (status >= 500) console.error(err.stack);

  res.status(status).json({
    mensaje: status >= 500 ? 'Ocurrió un error. Avisá a Sistemas con este código.' : err.message,
    id,
  });
}

module.exports = { ErrorHttp, asyncHandler, noEncontrado, manejarError };

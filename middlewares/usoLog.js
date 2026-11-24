// ============================================================================
// Registro de uso: una línea JSON por request a /api, con quién la hizo.
//
// Easy Auth sabe quién es el usuario pero no lo anota en los logs de Azure; esta
// línea sí, y va a stdout -> AppServiceConsoleLogs en el workspace log-offal.
// Consulta de ejemplo (Log Analytics):
//   AppServiceConsoleLogs
//   | where ResultDescription has '"evt":"uso"'
//   | extend u = parse_json(ResultDescription)
//   | summarize requests = count() by tostring(u.app), tostring(u.user), tostring(u.m), tostring(u.path)
//
// No se registra el query string ni el cuerpo (pueden traer datos), sólo la ruta.
// Origen: _plataforma/plantillas/middlewares/usoLog.js
// ============================================================================

module.exports = function usoLog(app) {
  return function (req, res, next) {
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      const user =
        req.headers['x-ms-client-principal-name'] ||
        (req.user && (req.user.Email || req.user.email)) ||
        null;
      console.log(
        JSON.stringify({
          evt: 'uso',
          app,
          user,
          m: req.method,
          path: (req.originalUrl || req.url).split('?')[0],
          st: res.statusCode,
          ms: Number((process.hrtime.bigint() - inicio) / 1000000n),
        })
      );
    });
    next();
  };
};

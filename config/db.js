const sql = require('mssql');

// ============================================================================
// Pool de conexión ESTÁNDAR a la base compartida (controletiquetas).
// - Sin DDL al arrancar: los cambios de esquema van en db/migrations/.
// - trustServerCertificate SOLO si se pide por variable (SQL Express local).
//   Contra *.database.windows.net el certificado es válido y no hace falta.
// - Cada app conecta con SU login (app_<esquema>), no con el admin del server.
// ============================================================================

const cfg = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false', // por defecto cifrado
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
  },
};

// ÚNICA diferencia con la plantilla de la plataforma: MODO_DEMO.
// Con MODO_DEMO=true la app arranca sin base y guarda en memoria (services/store.js),
// para mostrarles el formulario a los encargados antes de tener el App Service y
// la base. Es un flag explícito, igual que ALLOW_DEV_LOGIN: en Azure NO se carga.
// Cuando el módulo esté en Azure, sacar este bloque y volver a la plantilla tal cual.
const MODO_DEMO = process.env.MODO_DEMO === 'true';

const faltan = ['DB_USER', 'DB_PASS', 'DB_SERVER', 'DB_NAME'].filter((k) => !process.env[k]);
if (faltan.length && !MODO_DEMO) {
  // Falla al arrancar con un mensaje claro. Antes, DB_NAME vacío conectaba a
  // master y rompía recién al crear tablas ("Could not create constraint").
  console.error(`[DB] Faltan variables: ${faltan.join(', ')}. Ver .env.example.`);
  process.exit(1);
}
if (faltan.length && MODO_DEMO) {
  console.warn('[DB] MODO_DEMO: sin base. Los controles se guardan en memoria y se pierden al reiniciar.');
}

const poolPromise =
  faltan.length && MODO_DEMO
    ? Promise.resolve(null)
    : sql
        .connect(cfg)
        .then((pool) => {
          console.log(`[DB] Conectado a ${cfg.server}/${cfg.database} como ${cfg.user}`);
          return pool;
        })
        .catch((err) => {
          console.error('[DB] Error de conexión:', err.message);
          return null; // /health devuelve 503 y el middleware de auth responde 503
        });

module.exports = { sql, poolPromise };

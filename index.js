require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const path = require('node:path');
const fs = require('node:fs');
const rateLimit = require('express-rate-limit');
const { poolPromise } = require('./config/db');
const auth = require('./middlewares/auth');
const { modulosDe } = require('./lib/modulos');
const { noEncontrado, manejarError } = require('./middlewares/errores');
const roles = require('./config/roles');
const {
  CAMPOS_VISITA, SECCIONES, CHECKS, RESPUESTAS, NO_APLICA, SECTORES, FORM_META, ESTADOS,
} = require('./config/formConfig');

const app = express();
const APP_ENV = process.env.APP_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');

// Detrás del proxy de App Service: necesario para rate limit por IP real.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'same-origin' },
  })
);

// CORS SOLO si hay orígenes explícitos. Front y API comparten origen, así que
// en producción CORS_ORIGINS queda vacío y este bloque no monta nada.
const origenes = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (origenes.length) {
  app.use(require('cors')({ origin: origenes, credentials: true }));
}

app.use(express.json({ limit: '1mb' }));

app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

// Front compilado.
app.use(express.static(path.join(__dirname, 'client/dist')));

// Health público y liviano (probe del App Service).
app.get('/health', async (req, res) => {
  const pool = await poolPromise.catch(() => null);
  const demo = process.env.MODO_DEMO === 'true';
  res.status(pool || demo ? 200 : 503).json({
    status: pool ? 'ok' : demo ? 'demo' : 'degraded',
    db: !!pool,
    env: APP_ENV,
  });
});

/** Qué puede hacer el usuario. El permiso se vuelve a verificar en cada ruta. */
function permisosDe(user) {
  return { cargar: roles.puedeCargar(user), firmarSectores: roles.sectoresQueFirma(user) };
}

// Identidad: quién soy, el entorno (cinta TEST) y mis módulos (barra unificada).
app.get('/api/me', auth, async (req, res) =>
  res.json({
    nombre: req.user.Nombre,
    email: req.user.Email,
    rol: req.user.rol,
    registrado: req.user.registrado,
    env: APP_ENV,
    modulos: await modulosDe(req.user.UsuarioId),
    permisos: permisosDe(req.user),
  })
);

// Definición del formulario, para que el cliente lo renderice solo.
app.get('/api/form-config', auth, (req, res) =>
  res.json({
    meta: FORM_META,
    campos_visita: CAMPOS_VISITA,
    secciones: SECCIONES,
    checks: CHECKS,
    respuestas: RESPUESTAS,
    // Cuál de las respuestas es el "No aplica": el cliente no la escribe a mano.
    no_aplica: NO_APLICA,
    sectores: SECTORES,
    estados: ESTADOS,
    permisos: permisosDe(req.user),
  })
);

// Verificaciones: carga, listados, detalle y conforme.
app.use('/api/verificaciones', auth, require('./routes/verificaciones'));

// 404 de API en JSON y handler de errores único.
app.use('/api', noEncontrado);
app.use(manejarError);

// SPA fallback: cualquier ruta que no sea /api devuelve el index.
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'client/dist/index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(503).send('Frontend no compilado. Ejecutar npm run build en client/.');
});

const PORT = process.env.PORT || 3008;
if (require.main === module) {
  app.listen(PORT, () => console.log(`[${APP_ENV}] Verificación de Lectores escuchando en :${PORT}`));
}
module.exports = app;

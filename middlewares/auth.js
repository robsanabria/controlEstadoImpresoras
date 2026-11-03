const { poolPromise, sql } = require('../config/db');

// ============================================================================
// Middleware de autenticación ESTÁNDAR de la plataforma Offal.
// Origen: controlCodbars/middlewares/auth.js (referencia). Copiar tal cual y
// cambiar solo APP_KEY y el prefijo de REQUIRE_PERMISSION.
//
// Identidad: Azure Easy Auth (Entra ID) inyecta 'x-ms-client-principal-name'.
// Autorización: padrón central acceso.Usuarios + acceso.Permisos (App = APP_KEY).
// Último acceso: cada entrada deja fecha y conteo en acceso.UltimoAcceso
// (lo muestra Usuarios y Permisos). Ver registrarAcceso() más abajo.
// ============================================================================

// Clave de esta app en acceso.Permisos.App. CAMBIAR por sistema.
const APP_KEY = 'lectores';

// Login de desarrollo: SOLO con el flag explícito ALLOW_DEV_LOGIN=true.
// Nunca por NODE_ENV: si en Azure falta una variable, se devuelve 401 y no se
// suplanta a nadie. En Azure esta variable NO debe existir.
const ALLOW_DEV_LOGIN = process.env.ALLOW_DEV_LOGIN === 'true';

// Si es true, quien no tenga fila en acceso.Permisos para APP_KEY recibe 403.
// Si es false (migración), entra como "no registrado" y la app decide qué mostrar.
const REQUIRE_PERMISSION = process.env[`${APP_KEY.toUpperCase()}_REQUIRE_PERMISSION`] === 'true';

if (ALLOW_DEV_LOGIN && process.env.NODE_ENV === 'production') {
  // Falla ruidoso: es la combinación que abre la puerta en producción.
  console.error('[Auth] ALLOW_DEV_LOGIN=true con NODE_ENV=production. Abortando.');
  process.exit(1);
}

/** Convierte el formato de invitado de Entra (persona_dominio.com#EXT#@...) al mail real. */
function correoDeInvitado(email) {
  const i = email.indexOf('#EXT#');
  if (i === -1) return null;
  const base = email.slice(0, i);
  const guion = base.lastIndexOf('_');
  return guion === -1 ? null : `${base.slice(0, guion)}@${base.slice(guion + 1)}`;
}

// ---------------------------------------------------------------------------
// Último acceso. Graba "esta persona entró a este módulo" en acceso.UltimoAcceso
// (migración 003 de controlAccesos: una fila por persona y módulo, con fecha y
// conteo). Para no escribir en cada clic, se graba como mucho una vez cada
// ACCESO_CADA_MS por persona, en memoria de esta instancia. No espera la
// escritura ni corta el request: si falla (falta la tabla o el GRANT al usuario
// app_<modulo>) avisa UNA vez en el log y la app sigue andando igual.
// ---------------------------------------------------------------------------
const ACCESO_CADA_MS = 10 * 60 * 1000;
const ultimoGrabado = new Map(); // UsuarioId → ms del último grabado
let avisoAcceso = false;

function registrarAcceso(pool, usuarioId) {
  const ahora = Date.now();
  if (ahora - (ultimoGrabado.get(usuarioId) || 0) < ACCESO_CADA_MS) return;
  ultimoGrabado.set(usuarioId, ahora);
  pool
    .request()
    .input('uid', sql.Int, usuarioId)
    .input('app', sql.NVarChar(50), APP_KEY)
    .query(
      `MERGE acceso.UltimoAcceso AS d
       USING (SELECT @uid AS UsuarioId, @app AS App) AS o ON d.UsuarioId = o.UsuarioId AND d.App = o.App
       WHEN MATCHED THEN UPDATE SET UltimoAcceso = SYSUTCDATETIME(), Accesos = d.Accesos + 1
       WHEN NOT MATCHED THEN INSERT (UsuarioId, App, UltimoAcceso, Accesos) VALUES (@uid, @app, SYSUTCDATETIME(), 1);`
    )
    .catch((err) => {
      ultimoGrabado.delete(usuarioId);
      if (avisoAcceso) return;
      avisoAcceso = true;
      console.warn(`[${APP_KEY}/Auth] No se pudo grabar el último acceso (¿falta la migración 003 de accesos o el GRANT a este usuario?): ${err.message}`);
    });
}

module.exports = async function auth(req, res, next) {
  const email =
    req.headers['x-ms-client-principal-name'] ||
    (ALLOW_DEV_LOGIN ? process.env.DEV_EMAIL : null);

  if (!email) {
    // Si este warning NO aparece en el Log stream pero el navegador recibió 401,
    // el 401 lo devolvió Easy Auth antes de llegar acá (sesión vencida).
    console.warn(`[${APP_KEY}/Auth] 401 sin cabecera de identidad — ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ mensaje: 'Tu sesión venció. Iniciá sesión de nuevo.' });
  }

  try {
    const pool = await poolPromise;
    if (!pool) {
      if (REQUIRE_PERMISSION) return res.status(503).json({ mensaje: 'Padrón no disponible.' });
      req.user = { UsuarioId: null, Email: email, Nombre: null, rol: null, registrado: false };
      return next();
    }

    const alterno = correoDeInvitado(email);
    const result = await pool
      .request()
      .input('email', sql.NVarChar, email)
      .input('alterno', sql.NVarChar, alterno || email)
      .input('app', sql.NVarChar, APP_KEY)
      .query(`
        SELECT u.UsuarioId, u.Email, u.Nombre, p.Rol
        FROM acceso.Usuarios u
        LEFT JOIN acceso.Permisos p ON p.UsuarioId = u.UsuarioId AND p.App = @app
        WHERE u.Activo = 1 AND u.Email IN (@email, @alterno)
      `);

    const u = result.recordset[0];
    if (REQUIRE_PERMISSION && (!u || !u.Rol)) {
      // El mensaje incluye el mail EXACTO que mandó Entra: distingue "no está en
      // el padrón" de "está pero con el mail escrito distinto", que es el error
      // que más tiempo costó históricamente.
      console.warn(
        `[${APP_KEY}/Auth] 403 — mail de Entra: "${email}"` +
          (u ? ` | en el padrón (UsuarioId ${u.UsuarioId}) pero SIN permiso '${APP_KEY}'` : ' | NO existe en acceso.Usuarios')
      );
      return res.status(403).json({
        mensaje: u
          ? `Tu usuario (${email}) está registrado pero sin permiso para esta aplicación. Avisá a Sistemas con esa dirección.`
          : `Tu usuario (${email}) no figura en el padrón. Avisá a Sistemas copiando esa dirección tal cual.`,
      });
    }

    req.user = u
      ? { UsuarioId: u.UsuarioId, Email: u.Email, Nombre: u.Nombre, rol: u.Rol || null, registrado: true }
      : { UsuarioId: null, Email: email, Nombre: null, rol: null, registrado: false };

    // Entró: queda el último acceso. Sin await, no frena el request.
    if (u) registrarAcceso(pool, u.UsuarioId);

    next();
  } catch (err) {
    console.error(`[${APP_KEY}/Auth] Error:`, err.message);
    return res.status(500).json({ mensaje: 'Error en la verificación de identidad.' });
  }
};

/** Exige uno de los roles indicados. Uso: router.delete('/x', requiereRol('ADMIN'), handler) */
module.exports.requiereRol = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.rol)) {
    return res.status(403).json({ mensaje: 'No tenés permiso para esta acción.' });
  }
  next();
};

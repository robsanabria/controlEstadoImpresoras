const { poolPromise, sql } = require('../config/db');

// ============================================================================
// "Mis módulos" de la barra (ui/react/Navbar.jsx): los sistemas a los que la
// persona puede entrar, con nombre y URL. Lee acceso.Apps (catálogo, ver
// sql/acceso-apps.sql) cruzada con acceso.Permisos del usuario. Copiar tal
// cual a lib/modulos.js de cada sistema: no tiene nada que cambiar por app.
//
// Uso (sólo en /api/me, no en cada request):
//   const { modulosDe } = require('./lib/modulos');
//   app.get('/api/me', auth, async (req, res) =>
//     res.json({ nombre, email, rol, registrado, env, modulos: await modulosDe(req.user.UsuarioId) }));
//
// Nunca lanza: sin base, sin la tabla o con la consulta fallando devuelve []
// y lo deja en el log. Un problema acá no puede tirar /api/me: la barra sin
// lista simplemente no muestra la sección.
// ============================================================================

/**
 * @param {number|null} usuarioId acceso.Usuarios.UsuarioId (null si no está en el padrón:
 *                                entonces sólo ve los sistemas marcados Libre).
 * @returns {Promise<Array<{ clave: string, nombre: string, url: string }>>}
 */
async function modulosDe(usuarioId) {
  try {
    const pool = await poolPromise;
    if (!pool) return [];
    const r = await pool
      .request()
      .input('uid', sql.Int, usuarioId ?? null)
      .query(`
        SELECT a.App AS clave, a.Nombre AS nombre, a.Url AS url
        FROM acceso.Apps a
        LEFT JOIN acceso.Permisos p ON p.App = a.App AND p.UsuarioId = @uid
        WHERE a.Activa = 1 AND (a.Libre = 1 OR p.UsuarioId IS NOT NULL)
        ORDER BY a.Orden, a.Nombre
      `);
    return r.recordset;
  } catch (err) {
    console.error('[modulos] No se pudo leer acceso.Apps:', err.message);
    return [];
  }
}

module.exports = { modulosDe };

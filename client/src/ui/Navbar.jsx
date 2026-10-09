import { useEffect, useState } from 'react';

// Copiado desde plataforma/ui/react — NO EDITAR acá: cambiar en plataforma y
// propagar con scripts/ui-sync.sh. El HTML que genera es el contrato que
// comparten las versiones Blazor y Angular (ver ui/css/shell.css).

const PORTAL_URL_DEFAULT =
  import.meta.env.VITE_PORTAL_URL || 'https://indice.offalexpsa.ar';
const LOGOUT_URL_DEFAULT = '/.auth/logout?post_logout_redirect_uri=/';

// Iniciales para el avatar (Nombre Apellido → NA).
function iniciales(nombre, email) {
  if (nombre) {
    const p = nombre.trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
  }
  return (email?.[0] || '?').toUpperCase();
}

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" />
  </svg>
);

/**
 * Barra de navegación unificada Offal.
 *
 * @param {object}  usuario   { nombre, email, rol }  (respuesta de /api/me)
 * @param {string}  marca     nombre del módulo: "Calidad", "Choferes", "Tablero KPI"…
 * @param {string}  [env]     'production' | 'test' | 'dev'. Sólo distinto de production muestra la cinta.
 * @param {Array}   [secciones] pantallas DEL módulo: [{ clave, nombre, href, activa, onClick }].
 *                            En escritorio van como pastillas al lado de la marca; en tablet y
 *                            celular pasan al menú de usuario. `onClick(e)` permite navegar con
 *                            el router de la app (hacer e.preventDefault()).
 * @param {Array}   [modulos] [{ clave, nombre, url }] OTROS sistemas a los que la persona tiene
 *                            permiso; el activo se marca por `claveActual`. Sin lista, no se muestra.
 * @param {string}  [claveActual] clave de este módulo en acceso.Permisos.App
 * @param {string}  [portalUrl]   por defecto VITE_PORTAL_URL o el portal de producción
 * @param {string}  [logoutUrl]   por defecto el logout de Easy Auth
 * @param {function} [onCerrarSesion] si viene, "Cerrar sesión" llama esto en vez de navegar a logoutUrl
 *                            (para apps que tienen que limpiar algo antes de salir)
 * @param {Array}   [acciones] acciones propias del módulo dentro del menú de usuario:
 *                            [{ clave, nombre, onClick }] (Configuración, Gestionar usuarios…)
 * @param {ReactNode} [children] contenido extra entre la marca y la derecha (migas, buscador…)
 */
export default function Navbar({
  usuario, marca, env, secciones, modulos, claveActual,
  portalUrl = PORTAL_URL_DEFAULT, logoutUrl = LOGOUT_URL_DEFAULT, onCerrarSesion, acciones, children,
}) {
  const [abierto, setAbierto] = useState(false);
  const nombre = usuario?.nombre || usuario?.email || 'Usuario';
  const cinta = env && env !== 'production' ? env.toUpperCase() : null;
  const cerrar = () => setAbierto(false);

  // Escape cierra el menú.
  useEffect(() => {
    if (!abierto) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  const linkSeccion = (s, className) => (
    <a
      key={s.clave}
      className={`${className}${s.activa ? ' on' : ''}`}
      href={s.href}
      onClick={(e) => { s.onClick?.(e); cerrar(); }}
      aria-current={s.activa ? 'page' : undefined}
    >
      {s.nombre}
    </a>
  );

  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="brand" href={portalUrl} title="Ir al portal Offal">
          <span className="brand-badge"><img src="/logo.png" alt="Offal" /></span>
          <img className="brand-wordmark" src="/logo-offal.svg" alt="Offal Exp S.A." />
          <span className="brand-sep" aria-hidden="true">–</span>
          <span className="brand-sub">{marca}</span>
          {cinta && (
            <span className={`cinta${env === 'dev' ? ' cinta-dev' : ''}`} title="Los datos cargados acá no son reales">
              {cinta}
            </span>
          )}
        </a>

        {secciones?.length > 1 && (
          <nav className="nav-secciones" aria-label="Secciones">
            {secciones.map((s) => linkSeccion(s, 'nav-sec'))}
          </nav>
        )}

        {children}

        <div className="nav-right">
          <a className="nav-btn" href={portalUrl} title="Volver al portal" aria-label="Inicio">
            <IconHome /><span className="nav-btn-txt">Inicio</span>
          </a>

          <div className="user-wrap">
            <button
              className="user"
              onClick={() => setAbierto((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={abierto}
              aria-label={`Menú de ${nombre}`}
            >
              <span className="avatar">{iniciales(usuario?.nombre, usuario?.email)}</span>
              <span className="user-meta">
                <span className="user-name">{nombre}</span>
                {usuario?.rol && <span className="user-rol">{usuario.rol}</span>}
              </span>
              <span className="user-caret" aria-hidden="true">▾</span>
            </button>

            {abierto && (
              <>
                <div className="menu-backdrop" onClick={cerrar} />
                <div className="user-menu" role="menu">
                  <div className="user-menu-head">
                    <span className="user-menu-name">{nombre}</span>
                    {usuario?.email && <span className="user-menu-mail">{usuario.email}</span>}
                  </div>

                  {/* Las secciones del módulo sólo entran acá cuando no caben en la barra (tablet y celular). */}
                  {secciones?.length > 1 && (
                    <div className="user-menu-secciones">
                      <div className="user-menu-sec">Secciones</div>
                      {secciones.map((s) => linkSeccion(s, 'user-menu-item'))}
                    </div>
                  )}

                  {modulos?.length > 0 && (
                    <>
                      <div className="user-menu-sec">Mis módulos</div>
                      {modulos.map((m) => (
                        <a key={m.clave} className="user-menu-item" href={m.url} role="menuitem"
                          aria-current={m.clave === claveActual ? 'page' : undefined}>
                          <span className={`dot${m.clave === claveActual ? ' on' : ''}`} aria-hidden="true" />
                          {m.nombre}
                        </a>
                      ))}
                    </>
                  )}

                  {acciones?.length > 0 && (
                    <>
                      <div className="user-menu-sec">Opciones</div>
                      {acciones.map((a) => (
                        <button key={a.clave} type="button" className="user-menu-item" role="menuitem"
                          onClick={() => { cerrar(); a.onClick?.(); }}>
                          {a.nombre}
                        </button>
                      ))}
                    </>
                  )}

                  {onCerrarSesion ? (
                    <button type="button" className="user-menu-item salir" role="menuitem" onClick={() => { cerrar(); onCerrarSesion(); }}>
                      Cerrar sesión
                    </button>
                  ) : (
                    <a className="user-menu-item salir" href={logoutUrl} role="menuitem">Cerrar sesión</a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

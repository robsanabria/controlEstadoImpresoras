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

// Ícono SVG de línea (hereda color y tamaño del contenedor).
const svgIc = (hijos) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{hijos}</svg>
);
// Botón "waffle" del lanzador de módulos.
const IconApps = () => svgIc(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>);

// Ícono por módulo (clave = acceso.Apps.App). Fallback a un círculo si falta.
const ICONOS_MODULO = {
  kpi: svgIc(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
  presupuesto: svgIc(<><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>),
  contratos: svgIc(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>),
  proveedores: svgIc(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  lavados: svgIc(<><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>),
  choferes: svgIc(<><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>),
  etiquetas: svgIc(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>),
  calidad: svgIc(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>),
  panol: svgIc(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>),
  transporte: svgIc(<><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>),
  facturacion: svgIc(<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><line x1="6" y1="15" x2="10" y2="15" /></>),
  'facturacion-viajes': svgIc(<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><line x1="6" y1="15" x2="10" y2="15" /></>),
  lectores: svgIc(<><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>),
  'verificacion-lectores': svgIc(<><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>),
  rutinas: svgIc(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>),
  accesos: svgIc(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
};
const iconoModulo = (clave) => ICONOS_MODULO[clave] || svgIc(<><circle cx="12" cy="12" r="9" /></>);

/**
 * Barra de navegación unificada Offal (dos renglones).
 *
 * Renglón de arriba, igual en todos los sistemas: lanzador de módulos, marca
 * (logo + wordmark, sin el nombre del módulo), cinta de entorno, Inicio y
 * usuario. Renglón de abajo, sólo si el módulo tiene más de una pantalla: sus
 * secciones como pastillas, en todos los tamaños de pantalla.
 *
 * @param {object}  usuario   { nombre, email, rol }  (respuesta de /api/me)
 * @param {string}  marca     nombre del módulo: "Calidad", "Choferes", "Tablero KPI"…
 *                            Ya no se dibuja en la barra (pedido de gerencia, 2026-11); queda
 *                            para accesibilidad: etiqueta el renglón de secciones.
 * @param {string}  [env]     'production' | 'test' | 'dev'. Sólo distinto de production muestra la cinta.
 * @param {Array}   [secciones] pantallas DEL módulo: [{ clave, nombre, href, activa, onClick }].
 *                            Van en el renglón de abajo; si no entran, el renglón se desplaza
 *                            de costado. `onClick(e)` permite navegar con el router de la app
 *                            (hacer e.preventDefault()).
 * @param {Array}   [modulos] [{ clave, nombre, url }] OTROS sistemas a los que la persona tiene
 *                            permiso; el activo se marca por `claveActual`. Sin lista, no se muestra
 *                            el lanzador.
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
  const [appsAbierto, setAppsAbierto] = useState(false);
  const nombre = usuario?.nombre || usuario?.email || 'Usuario';
  const cinta = env && env !== 'production' ? env.toUpperCase() : null;
  const conSecciones = secciones?.length > 1;
  const cerrar = () => { setAbierto(false); setAppsAbierto(false); };
  const toggleUsuario = () => { setAppsAbierto(false); setAbierto((v) => !v); };
  const toggleApps = () => { setAbierto(false); setAppsAbierto((v) => !v); };

  // Escape cierra cualquier menú abierto.
  useEffect(() => {
    if (!abierto && !appsAbierto) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, appsAbierto]);

  return (
    <header className="nav">
      <div className="nav-inner">
        {modulos?.length > 0 && (
          <div className="nav-apps">
            <button
              className="nav-apps-btn"
              onClick={toggleApps}
              aria-haspopup="menu"
              aria-expanded={appsAbierto}
              aria-label="Cambiar de módulo"
              title="Cambiar de módulo"
            >
              <IconApps />
            </button>
            {appsAbierto && (
              <>
                <div className="menu-backdrop" onClick={cerrar} />
                <div className="nav-apps-panel" role="menu">
                  <div className="nav-apps-head">Cambiar de módulo</div>
                  <div className="nav-apps-grid">
                    {modulos.map((m) => (
                      <a
                        key={m.clave}
                        className={`app-tile${m.clave === claveActual ? ' on' : ''}`}
                        href={m.url}
                        role="menuitem"
                        aria-current={m.clave === claveActual ? 'page' : undefined}
                        onClick={cerrar}
                      >
                        <span className="app-tile-ic">{iconoModulo(m.clave)}</span>
                        <span className="app-tile-nombre">{m.nombre}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <a className="brand" href={portalUrl} title="Ir al portal Offal">
          <span className="brand-badge"><img src="/logo.png" alt="Offal" /></span>
          <img className="brand-wordmark" src="/logo-offal.svg" alt="Offal Exp S.A." />
          {cinta && (
            <span className={`cinta${env === 'dev' ? ' cinta-dev' : ''}`} title="Los datos cargados acá no son reales">
              {cinta}
            </span>
          )}
        </a>

        {children}

        <div className="nav-right">
          <a className="nav-btn" href={portalUrl} title="Volver al portal" aria-label="Inicio">
            <IconHome /><span className="nav-btn-txt">Inicio</span>
          </a>

          <div className="user-wrap">
            <button
              className="user"
              onClick={toggleUsuario}
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

      {/* Renglón del módulo: sus pantallas, siempre a la vista (también en celular). */}
      {conSecciones && (
        <nav className="nav-sub" aria-label={marca ? `Secciones de ${marca}` : 'Secciones'}>
          <div className="nav-sub-inner">
            {secciones.map((s) => (
              <a
                key={s.clave}
                className={`nav-sec${s.activa ? ' on' : ''}`}
                href={s.href}
                onClick={(e) => { s.onClick?.(e); cerrar(); }}
                aria-current={s.activa ? 'page' : undefined}
              >
                {s.nombre}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

// Llama a la API del módulo. En producción, Easy Auth ya puso la cabecera de
// identidad; en dev, el backend simula el usuario (DEV_EMAIL).
// El portal y el logout los resuelve ui/Navbar.jsx, no hace falta exportarlos acá.

/**
 * El servidor contesta siempre { mensaje } (y { id } si fue un 500): ese texto
 * ya está escrito para el usuario, así que se muestra tal cual. Si la respuesta
 * no trae mensaje, ponemos uno genérico en castellano.
 */
async function json(res) {
  if (res.ok) return res.json();

  let cuerpo = {};
  try { cuerpo = await res.json(); } catch { /* la respuesta no era JSON */ }

  const generico =
    res.status === 401 || res.status === 403
      ? 'Tu sesión venció o no tenés permiso. Volvé a entrar.'
      : 'No pudimos completar la operación. Volvé a intentar.';

  const err = new Error(cuerpo.mensaje || generico);
  if (cuerpo.id) err.message += ` (código ${cuerpo.id})`;
  if (res.status === 401) err.code = 'NO_AUTH';
  if (res.status === 403) err.code = 'NO_PERM';
  if (res.status === 409) err.code = 'CONFLICTO';
  throw err;
}

/** fetch con el mensaje de red en castellano (sin err.message del navegador). */
async function pedir(url, opciones) {
  let res;
  try {
    res = await fetch(url, { credentials: 'include', ...opciones });
  } catch {
    throw new Error('No pudimos conectar con el servidor. Revisá la conexión y volvé a intentar.');
  }
  return json(res);
}

const GET = (url) => pedir(url);
const POST = (url, body) =>
  pedir(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const getMe = () => GET('/api/me');
export const getFormConfig = () => GET('/api/form-config');
export const getVerificaciones = (estado) =>
  GET(`/api/verificaciones${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`);
export const getVerificacion = (id) => GET(`/api/verificaciones/${id}`);
// Filas planas (una por chequeo) para el CSV del historial.
export const getExport = () => GET('/api/verificaciones/export');
export const crearVerificacion = (payload) => POST('/api/verificaciones', payload);
export const firmarVerificacion = (id, decision, comentario) =>
  POST(`/api/verificaciones/${id}/conforme`, { decision, comentario });

/**
 * Link profundo del QR: /firmar/<id>.
 *
 * El flujo real en planta es: el de Sistemas recorre la línea con el celular y
 * carga la verificación; el encargado del sector firma el conforme en el
 * momento, pero DESDE SU PROPIO celular, porque el firmante sale siempre de la
 * sesión de Easy Auth y nadie firma en nombre de otro. El puente entre los dos
 * teléfonos es este link, que se muestra como QR.
 *
 * El servidor sirve index.html para cualquier ruta (el `app.get('*')` de
 * index.js), así que la URL se puede abrir directo: Easy Auth manda al login,
 * el encargado vuelve acá ya identificado y cae en la pantalla de firma.
 *
 * El link NO es una credencial: sólo lleva el número de verificación. Quien lo
 * abra tiene que autenticarse igual y tener rol de encargado del sector, y eso
 * lo revalida el servidor en cada pedido. Que el QR se filtre no habilita a
 * nadie a firmar.
 */

export const RUTA_FIRMA = '/firmar';

/** Número de verificación si la URL actual es un link de firma; si no, null. */
export function idDeLaUrl(pathname) {
  const ruta = pathname ?? window.location.pathname;
  const m = /^\/firmar\/(\d+)\/?$/.exec(ruta);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** URL absoluta que se codifica en el QR. */
export function urlDeFirma(id, origen) {
  return `${origen ?? window.location.origin}${RUTA_FIRMA}/${id}`;
}

/**
 * Saca /firmar/<id> de la barra de direcciones sin recargar, para que el
 * encargado pueda seguir usando el módulo completo después de firmar (y para
 * que un F5 no lo devuelva a la misma pantalla).
 */
export function salirDeLaFirma() {
  window.history.replaceState(null, '', '/');
}

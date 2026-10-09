/**
 * Quién carga la verificación y quién la firma.
 *
 * El rol viene del padrón central (acceso.Permisos.Rol para la app 'lectores').
 * Hay dos capacidades bien separadas:
 *   - CARGAR  → el operario de Sistemas completa el checklist.
 *   - FIRMAR  → el encargado del sector da el conforme.
 *
 * El conforme está acotado por sector: el encargado de Insumos no firma
 * controles de Empaque. Para agregar un sector nuevo se suma acá y en
 * SECTORES de formConfig.js.
 */

// Clave de la app en el padrón central (acceso.Permisos.App).
const APP_KEY = 'lectores';

// Roles que pueden cargar una verificación.
const ROLES_CARGA = ['admin', 'sistemas'];

// Roles que pueden dar el conforme, y qué sectores alcanza cada uno.
// '*' = todos los sectores.
const ROLES_FIRMA = {
  admin: '*',
  encargado: '*',
  encargado_insumos: ['Insumos'],
  encargado_empaque: ['Empaque'],
};

/** Normaliza el rol del padrón: minúsculas, sin espacios ni acentos. */
function normalizar(rol) {
  if (!rol) return null;
  return String(rol)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]+/g, '_');
}

/**
 * ¿Hay que exigir rol del padrón?
 * Mientras la app no esté cargada en acceso.Permisos se deja en false: cualquier
 * usuario autenticado por Easy Auth puede cargar y firmar. Con la app cargada se
 * pone LECTORES_REQUIRE_PERMISSION=true y manda el rol.
 */
function exigeRol() {
  return process.env.LECTORES_REQUIRE_PERMISSION === 'true';
}

/** ¿Puede cargar una verificación? */
function puedeCargar(user) {
  const rol = normalizar(user?.rol);
  if (!exigeRol() && !rol) return true;
  return ROLES_CARGA.includes(rol);
}

/** Sectores que el usuario puede firmar: '*' (todos) o un array. */
function sectoresQueFirma(user) {
  const rol = normalizar(user?.rol);
  if (!exigeRol() && !rol) return '*';
  return ROLES_FIRMA[rol] || [];
}

/** ¿Puede firmar el conforme de una verificación de este sector? */
function puedeFirmar(user, sector) {
  const alcance = sectoresQueFirma(user);
  if (alcance === '*') return true;
  return alcance.includes(sector);
}

/**
 * ¿Se permite que el mismo usuario que cargó la verificación la firme?
 * En producción NO: la firma vale porque la da otra persona (el encargado).
 * Para probar en local se habilita con PERMITIR_AUTOFIRMA=true.
 */
function permiteAutofirma() {
  return process.env.PERMITIR_AUTOFIRMA === 'true';
}

module.exports = {
  APP_KEY,
  ROLES_CARGA,
  ROLES_FIRMA,
  normalizar,
  exigeRol,
  puedeCargar,
  sectoresQueFirma,
  puedeFirmar,
  permiteAutofirma,
};

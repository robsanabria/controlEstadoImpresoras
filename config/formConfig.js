/**
 * Definición del formulario "VERIFICACIÓN DE LECTORES".
 *
 * Es la ÚNICA fuente de verdad: de acá salen (1) las columnas de la cabecera en
 * SQL, (2) las preguntas que se muestran, (3) la validación del servidor y
 * (4) las columnas del CSV. Para cambiar el formulario se edita este archivo.
 *
 * ---------------------------------------------------------------------------
 * Cómo se mapea el Microsoft Form original
 * ---------------------------------------------------------------------------
 * El Form tiene 20 preguntas, pero son 10 chequeos: cada "Especificar
 * problemática" es el seguimiento del Sí/No anterior. Acá se modela como UN
 * chequeo con dos datos (respuesta + problemática), y el campo de texto sólo
 * aparece cuando la respuesta no es la esperada. Se completa mucho más rápido y
 * no se pierde ningún dato del Form: en el CSV salen las dos columnas, con la
 * numeración original (`nro` = Sí/No, `nroProblematica` = el texto).
 *
 * En todos los chequeos lo esperado es "Si": el lector TIENE que rechazar (o
 * etiquetar el error). Un "No" es la falla, y por eso pide la problemática.
 * "No aplica" no existe en el Form original: se sumó para las estaciones que no
 * están en la línea que se verifica. No cuenta como falla y no exige texto.
 */

// Secciones del Form, en orden. Cada una es una estación de la línea.
const SECCIONES = [
  { id: 'armado_cajas', nombre: 'Armado de cajas' },
  { id: 'troneras', nombre: 'Troneras' },
  { id: 'empaque', nombre: 'Empaque' },
  { id: 'rechazo', nombre: 'Rechazo' },
  { id: 'balanza', nombre: 'Balanza' },
  { id: 'rechazo_despostada', nombre: 'Rechazo despostada' },
];

// Ayuda que el Form muestra en las preguntas de validación.
const AYUDA_VALIDACION = 'Realizar la prueba colocando una caja con otro artículo.';

/**
 * Los 10 chequeos, en el orden del Form.
 *   id              → clave JSON y valor guardado en la columna PreguntaId
 *   seccion         → id de SECCIONES
 *   nro             → número de la pregunta Sí/No en el Form original
 *   nroProblematica → número de la pregunta de texto que le corresponde
 *   texto           → la pregunta tal cual
 *   ayuda           → aclaración de cómo hacer la prueba
 *   esperado        → respuesta que significa "anda bien"; cualquier otra pide problemática
 */
const CHECKS = [
  {
    id: 'armado_no_lectura', seccion: 'armado_cajas', nro: 1, nroProblematica: 2,
    texto: '¿Rechaza no lectura en armado de cajas?', esperado: 'Si',
  },
  {
    id: 'armado_validacion', seccion: 'armado_cajas', nro: 3, nroProblematica: 4,
    texto: '¿Rechaza validación en armado de cajas?', ayuda: AYUDA_VALIDACION, esperado: 'Si',
  },
  {
    id: 'tronera_no_lectura', seccion: 'troneras', nro: 5, nroProblematica: 6,
    texto: '¿Rechaza no lectura en la tronera?', esperado: 'Si',
  },
  {
    id: 'tronera_validacion', seccion: 'troneras', nro: 7, nroProblematica: 8,
    texto: '¿Rechaza validación en la tronera?', ayuda: AYUDA_VALIDACION, esperado: 'Si',
  },
  {
    id: 'empaque_preetiqueta', seccion: 'empaque', nro: 9, nroProblematica: 10,
    texto: '¿Imprime etiqueta error no lectura de preetiqueta?', esperado: 'Si',
  },
  {
    id: 'rechazo_no_lectura', seccion: 'rechazo', nro: 11, nroProblematica: 12,
    texto: '¿Rechaza no lectura de rechazo?', esperado: 'Si',
  },
  {
    id: 'rechazo_validacion', seccion: 'rechazo', nro: 13, nroProblematica: 14,
    texto: '¿Rechaza validación de rechazo?', ayuda: AYUDA_VALIDACION, esperado: 'Si',
  },
  {
    id: 'balanza_peso', seccion: 'balanza', nro: 15, nroProblematica: 16,
    texto: '¿Etiqueta error no lectura de peso en la balanza?', esperado: 'Si',
  },
  {
    id: 'despostada_no_lectura', seccion: 'rechazo_despostada', nro: 17, nroProblematica: 18,
    texto: '¿Rechaza no lectura de despostada?', esperado: 'Si',
  },
  {
    id: 'despostada_validacion', seccion: 'rechazo_despostada', nro: 19, nroProblematica: 20,
    texto: '¿Rechaza validación de despostada?', ayuda: AYUDA_VALIDACION, esperado: 'Si',
  },
];

// Respuestas posibles de cada chequeo. El Form original es Sí/No; "No aplica"
// se agregó para las estaciones que no corresponden a lo que se está verificando.
const NO_APLICA = 'No aplica';
const RESPUESTAS = ['Si', 'No', NO_APLICA];

// ---------------------------------------------------------------------------
// Cabecera de la verificación (una fila en sistemas.VerificacionLectores).
// No está en el Form original: es lo mínimo para saber quién verificó, cuándo y
// a qué encargado le toca firmar el conforme.
// ---------------------------------------------------------------------------
const SECTORES = ['Insumos', 'Empaque'];
const TURNOS = ['Mañana', 'Tarde', 'Noche'];

const CAMPOS_VISITA = [
  { name: 'fecha', label: 'Fecha de la verificación', type: 'date', required: true, sqlType: 'date' },
  { name: 'sector', label: 'Sector que da el conforme', type: 'select', required: true, options: SECTORES,
    sqlType: 'nvarchar', help: 'Insumos o Empaque: define de qué sector es el encargado que firma.' },
  // Obligatorio: el conforme lo da el encargado DEL TURNO, así que sin turno no
  // se sabe a quién le toca firmar.
  { name: 'turno', label: 'Turno', type: 'select', required: true, options: TURNOS, sqlType: 'nvarchar',
    help: 'Firma el encargado de este turno.' },
  { name: 'observaciones_generales', label: 'Observaciones generales', type: 'textarea', required: false,
    sqlType: 'texto', help: 'Opcional. Algo que valga para toda la verificación.' },
];

// Metadatos del módulo.
const FORM_META = {
  titulo: 'Verificación de Lectores',
  descripcion:
    'Sistemas hace la prueba de los lectores de la línea y responde los 10 chequeos. ' +
    'Al guardar queda pendiente de conforme hasta que el encargado del sector lo firme con su usuario.',
  esquema: 'sistemas',
  tabla: 'sistemas.VerificacionLectores',
  tablaNombre: 'VerificacionLectores',
  tablaDetalle: 'sistemas.VerificacionLectoresDetalle',
  tablaDetalleNombre: 'VerificacionLectoresDetalle',
};

// Estados del circuito de conforme.
const ESTADOS = {
  PENDIENTE: 'Pendiente',
  CONFORME: 'Conforme',
  OBSERVADO: 'Observado',
};

/** El chequeo por id (lo usan la validación y el armado del detalle). */
const CHECK_POR_ID = Object.fromEntries(CHECKS.map((c) => [c.id, c]));

/** ¿Esta respuesta es una falla? (y entonces exige problemática) */
function esFalla(check, respuesta) {
  return !!respuesta && respuesta !== check.esperado && respuesta !== NO_APLICA;
}

/**
 * ¿Hay que pedir texto para esta respuesta?
 * Obligatorio cuando es falla; opcional para aclarar un "No aplica".
 */
function pideTexto(check, respuesta) {
  return !!respuesta && respuesta !== check.esperado;
}

module.exports = {
  SECCIONES,
  CHECKS,
  CHECK_POR_ID,
  RESPUESTAS,
  NO_APLICA,
  CAMPOS_VISITA,
  SECTORES,
  TURNOS,
  FORM_META,
  ESTADOS,
  esFalla,
  pideTexto,
};

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
// Secciones del Form, en orden. Cada una es una estación de la línea.
//
// Las estaciones que tienen MÁS DE UNA unidad en planta llevan `unidad`: el
// sistema sortea cuál se verifica, para que no se termine controlando siempre
// la misma (la más cómoda o la más cercana). Se puede cambiar por otra, pero
// hay que escribir por qué, y el sorteo queda guardado igual.
//
// Para cambiar la cantidad de unidades de una estación, o sumar una nueva, se
// edita acá y listo: de esto salen las columnas SQL, los desplegables y la
// validación. Si cambia la cantidad, hay que regenerar la migración.
// Cada estación pertenece a UN sector, y el sector es el recorrido: quien carga
// elige qué recorrido va a hacer y responde sólo las estaciones de ese sector.
// El mismo sector define después qué encargado firma el conforme.
const SECCIONES = [
  { id: 'armado_cajas', nombre: 'Armado de cajas', sector: 'Insumos',
    unidad: { campo: 'armadora', nombre: 'Armadora', cantidad: 4 } },
  { id: 'troneras', nombre: 'Troneras', sector: 'Empaque',
    unidad: { campo: 'tronera', nombre: 'Tronera', cantidad: 10 } },
  { id: 'empaque', nombre: 'Empaque', sector: 'Empaque',
    unidad: { campo: 'linea_empaque', nombre: 'Línea de empaque', cantidad: 3 } },
  { id: 'rechazo', nombre: 'Rechazo', sector: 'Empaque' },
  { id: 'balanza', nombre: 'Balanza', sector: 'Empaque',
    unidad: { campo: 'balanza', nombre: 'Balanza', cantidad: 3 } },
  { id: 'rechazo_despostada', nombre: 'Rechazo despostada', sector: 'Despostada' },
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
// Los recorridos. Salen de las estaciones: un sector existe porque tiene
// estaciones, así que agregar una estación con un sector nuevo lo crea solo.
// OJO: un sector nuevo necesita su rol de firma en config/roles.js y los
// encargados cargados en el padrón, o nadie va a poder firmar ese recorrido.
const SECTORES = [...new Set(SECCIONES.map((s) => s.sector))];
const TURNOS = ['Mañana', 'Tarde', 'Noche'];

/**
 * Campos de la cabecera (una columna cada uno en sistemas.VerificacionLectores).
 *
 * Los que llevan `seccion` NO se muestran arriba con los datos generales: se
 * renderizan dentro de esa sección del cuestionario, porque son contexto de esa
 * estación. Igual son columnas de la cabecera, así se reportan y se exportan sin
 * tener que abrir el detalle.
 *
 * `type: 'oculto'` → no se dibuja; lo completa el formulario (el sorteo).
 * `exigidoSiDistinto` → el campo pasa a obligatorio cuando los dos campos que
 * nombra tienen valores distintos. Lo valida el servidor, no sólo el cliente.
 */
const CAMPOS_VISITA = [
  { name: 'fecha', label: 'Fecha de la verificación', type: 'date', required: true, sqlType: 'date' },
  // El recorrido ES el sector: define qué estaciones se responden y qué
  // encargado firma el conforme.
  { name: 'sector', label: 'Recorrido que vas a hacer', type: 'select', required: true,
    options: SECTORES, sqlType: 'nvarchar',
    help: 'Define qué estaciones entran y qué encargado firma el conforme.' },
  // Obligatorio: el conforme lo da el encargado DEL TURNO, así que sin turno no
  // se sabe a quién le toca firmar.
  { name: 'turno', label: 'Turno', type: 'select', required: true, options: TURNOS, sqlType: 'nvarchar',
    help: 'Firma el encargado de este turno.' },
  { name: 'observaciones_generales', label: 'Observaciones generales', type: 'textarea', required: false,
    sqlType: 'texto', help: 'Opcional. Algo que valga para toda la verificación.' },
];

/**
 * Los tres campos que genera cada estación con más de una unidad:
 *   <campo>_sorteada → la que salió sorteada (la completa el formulario)
 *   <campo>          → la que realmente se verificó
 *   <campo>_motivo   → por qué se cambió, obligatorio sólo si difieren
 *
 * No son obligatorios en SQL: una estación marcada entera como "No aplica" no
 * tiene unidad que registrar. Que la unidad sea obligatoria cuando SÍ se revisó
 * lo controla el servidor (routes/verificaciones.js).
 */
function camposDeUnidad(seccion) {
  const u = seccion.unidad;
  if (!u) return [];
  const opciones = Array.from({ length: u.cantidad }, (_, i) => String(i + 1));
  const art = /^[aeiou]/i.test(u.nombre) ? '' : '';
  return [
    { name: `${u.campo}_sorteada`, label: `${u.nombre} sorteada`, type: 'oculto',
      sqlType: 'int', seccion: seccion.id },
    { name: u.campo, label: `${u.nombre} verificada`, type: 'select', options: opciones,
      sqlType: 'int', seccion: seccion.id,
      help: `Viene la sorteada. Si se verificó otra${art}, elegila y explicá por qué.` },
    { name: `${u.campo}_motivo`, label: `Por qué se cambió de ${u.nombre.toLowerCase()}`,
      type: 'textarea', sqlType: 'texto', seccion: seccion.id,
      exigidoSiDistinto: [u.campo, `${u.campo}_sorteada`] },
  ];
}

// Columnas de la cabecera: las generales + las de unidad de cada estación.
CAMPOS_VISITA.push(...SECCIONES.flatMap(camposDeUnidad));

// Metadatos del módulo.
const FORM_META = {
  titulo: 'Verificación de Lectores',
  descripcion:
    'Elegí el recorrido que vas a hacer y respondé las estaciones de ese sector, una por una. ' +
    'La verificación NO vale hasta que la firma el encargado del sector con su propio usuario: ' +
    'hasta entonces queda pendiente de conforme.',
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

/** Las estaciones de un recorrido, en orden. */
function seccionesDeSector(sector) {
  return SECCIONES.filter((s) => s.sector === sector);
}

/** Los chequeos de un recorrido (los de sus estaciones). */
function checksDeSector(sector) {
  const ids = new Set(seccionesDeSector(sector).map((s) => s.id));
  return CHECKS.filter((c) => ids.has(c.seccion));
}

/** Campos de la cabecera que van dentro de una sección del cuestionario. */
function camposDeSeccion(seccionId) {
  return CAMPOS_VISITA.filter((c) => c.seccion === seccionId);
}

module.exports = {
  SECCIONES,
  seccionesDeSector,
  checksDeSector,
  camposDeSeccion,
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

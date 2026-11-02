/**
 * Resumen diario: a día vencido, mira el día anterior y avisa por correo
 * SÓLO si hubo menos verificaciones de las que se esperan.
 *
 * La regla la definió Sistemas (2026-11-02): tres o más verificaciones en el
 * día está OK y no llega nada; con menos de tres sale el aviso. Se cuentan
 * todas las del día, de cualquier recorrido y en cualquier estado.
 *
 * El corte es por el campo `fecha` de la verificación (el día recorrido), no
 * por cuándo se cargó. Así, cargar a la madrugada la recorrida de ayer cuenta
 * para ayer.
 */
const store = require('./store');
const { SECTORES } = require('../config/formConfig');

/** Mínimo de verificaciones por día para considerar el día OK. */
const MINIMO = Number(process.env.RESUMEN_MINIMO || 3);

/** A quiénes les llega el aviso. En Azure se sobreescribe con RESUMEN_DESTINATARIOS. */
const DESTINATARIOS = (process.env.RESUMEN_DESTINATARIOS ||
  'nicolas.gutierrez@offal.com.ar,andrea.cardozo@offal.com.ar')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// La planta trabaja en hora de Argentina; el servidor está en UTC.
const TZ = process.env.RESUMEN_TZ || 'America/Argentina/Buenos_Aires';

/** Fecha de ayer en hora local de planta, como 'YYYY-MM-DD'. */
function ayer(hoy = new Date()) {
  const local = new Date(hoy.toLocaleString('en-US', { timeZone: TZ }));
  local.setDate(local.getDate() - 1);
  const mes = String(local.getMonth() + 1).padStart(2, '0');
  const dia = String(local.getDate()).padStart(2, '0');
  return `${local.getFullYear()}-${mes}-${dia}`;
}

function enCastellano(fecha) {
  const [a, m, d] = fecha.split('-');
  return `${d}/${m}/${a}`;
}

/**
 * Arma el resumen de un día.
 * @returns {{fecha, total, minimo, hayQueAvisar, porSector, pendientes, asunto, texto}}
 */
async function resumenDe(fecha) {
  const filas = await store.delDia(fecha);
  const total = filas.length;

  const porSector = SECTORES.map((s) => ({
    sector: s,
    cantidad: filas.filter((f) => f.sector === s).length,
  }));
  const pendientes = filas.filter((f) => f.Estado === 'Pendiente').length;

  const hayQueAvisar = total < MINIMO;
  const detalle = porSector.map((s) => `${s.sector}: ${s.cantidad}`).join(' · ');

  const asunto =
    total === 0
      ? `Verificación de Lectores: NO hubo verificaciones el ${enCastellano(fecha)}`
      : `Verificación de Lectores: sólo ${total} verificaci${total === 1 ? 'ón' : 'ones'} el ${enCastellano(fecha)}`;

  const texto = [
    `Resumen del ${enCastellano(fecha)}.`,
    '',
    `Verificaciones cargadas: ${total} (lo esperado es al menos ${MINIMO}).`,
    `Por recorrido — ${detalle}.`,
    pendientes > 0
      ? `Pendientes de conforme: ${pendientes}. Esas todavía no las firmó el encargado.`
      : 'Todas las del día tienen el conforme firmado.',
    '',
    'Este aviso sale sólo los días que no llegan al mínimo.',
    'Verificación de Lectores · https://verificacion.offalexpsa.ar',
  ].join('\n');

  return { fecha, total, minimo: MINIMO, hayQueAvisar, porSector, pendientes, asunto, texto };
}

module.exports = { resumenDe, ayer, DESTINATARIOS, MINIMO };

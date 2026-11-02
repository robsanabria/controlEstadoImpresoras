const express = require('express');
const store = require('../services/store');
const roles = require('../config/roles');
const { ErrorHttp, asyncHandler } = require('../middlewares/errores');
const {
  CAMPOS_VISITA, CHECK_POR_ID, RESPUESTAS, NO_APLICA, SECCIONES, ESTADOS,
  seccionesDeSector, checksDeSector, esFalla, pideTexto,
} = require('../config/formConfig');

const router = express.Router();

// ---------------------------------------------------------------------------
// Validación contra la definición del formulario (config/formConfig.js)
// ---------------------------------------------------------------------------

/** Valida la cabecera contra CAMPOS_VISITA. */
function validarCabecera(body) {
  const datos = {};
  const errores = [];

  for (const c of CAMPOS_VISITA) {
    let v = body?.[c.name];
    const vacio = v === undefined || v === null || String(v).trim() === '';

    if (vacio) {
      if (c.required) errores.push(`Falta "${c.label}".`);
      datos[c.name] = null;
      continue;
    }
    if (c.type === 'select' && Array.isArray(c.options) && !c.options.includes(String(v))) {
      errores.push(`"${c.label}": valor no válido.`);
      continue;
    }
    if (c.sqlType === 'int') {
      const n = Number(v);
      if (!Number.isInteger(n)) { errores.push(`"${c.label}" tiene que ser un número entero.`); continue; }
      v = n;
    } else if (c.sqlType === 'texto') v = String(v).slice(0, 1000);
    else if (c.sqlType === 'nvarchar') v = String(v).slice(0, 255);
    datos[c.name] = v;
  }

  // Campos que recién se vuelven obligatorios cuando otros dos difieren: hoy es
  // el motivo del cambio de tronera. Si verificaron una tronera distinta de la
  // sorteada, tienen que decir por qué; si no, el sorteo no sirve de nada.
  for (const c of CAMPOS_VISITA) {
    if (!c.exigidoSiDistinto) continue;
    const [uno, otro] = c.exigidoSiDistinto;
    const cambio =
      datos[uno] !== null && datos[otro] !== null && String(datos[uno]) !== String(datos[otro]);
    if (cambio && !datos[c.name]) errores.push(`Falta "${c.label}".`);
    // Si no hubo cambio, el motivo no corresponde y no se guarda.
    if (!cambio) datos[c.name] = null;
  }

  return { datos, errores };
}

/**
 * Valida las respuestas y arma las filas del detalle.
 *
 * El cliente manda { id: { respuesta, problematica } }. El texto y el número de
 * la pregunta NO se toman del cliente: salen de formConfig.js, así que lo que
 * queda guardado es la pregunta que el sistema realmente hizo.
 *
 * Se piden exactamente los chequeos DEL RECORRIDO elegido: ni de menos (faltan
 * respuestas) ni de más (preguntas de otro sector, que no se recorrió).
 */
function validarRespuestas(body, sector) {
  const errores = [];
  const filas = [];
  const recibidas = body?.respuestas || {};
  const delSector = checksDeSector(sector);
  const idsDelSector = new Set(delSector.map((c) => c.id));

  for (const check of delSector) {
    const cruda = recibidas[check.id] || {};
    const respuesta = String(cruda.respuesta ?? '').trim();
    const problematica = String(cruda.problematica ?? '').trim().slice(0, 1000);

    if (!respuesta) {
      errores.push(`Falta responder la pregunta ${check.nro}: "${check.texto}".`);
      continue;
    }
    if (!RESPUESTAS.includes(respuesta)) {
      errores.push(`Pregunta ${check.nro}: respuesta no válida.`);
      continue;
    }

    const falla = esFalla(check, respuesta);
    if (falla && !problematica) {
      errores.push(
        `Pregunta ${check.nro}: respondiste "${respuesta}", así que hay que especificar la problemática (${check.nroProblematica}).`
      );
      continue;
    }

    filas.push({
      Seccion: check.seccion,
      PreguntaId: check.id,
      PreguntaNro: check.nro,
      Pregunta: check.texto,
      Respuesta: respuesta,
      // Texto sólo cuando la respuesta no es la esperada: obligatorio si es
      // falla, opcional para aclarar un "No aplica".
      Problematica: pideTexto(check, respuesta) ? problematica || null : null,
      EsFalla: falla,
    });
  }

  // Claves que no corresponden: cliente desactualizado, o respuestas de un
  // recorrido que no es el elegido.
  Object.keys(recibidas).forEach((id) => {
    if (!CHECK_POR_ID[id]) {
      errores.push(`La pregunta "${id}" no existe en el formulario.`);
    } else if (!idsDelSector.has(id) && recibidas[id]?.respuesta) {
      errores.push(`La pregunta ${CHECK_POR_ID[id].nro} no es del recorrido de ${sector}.`);
    }
  });

  return { filas, errores };
}

/**
 * Unidad verificada por estación (tronera, armadora, línea de empaque, balanza).
 *
 * Si la estación se revisó —o sea, si alguna de sus preguntas tiene una
 * respuesta distinta de "No aplica"— hay que decir en qué unidad se hizo la
 * prueba: sin eso, el sorteo no sirve para nada. Si no se revisó, se limpia la
 * unidad y el motivo, pero se conserva cuál había salido sorteada.
 *
 * Muta `visita` a propósito: es el objeto que se va a guardar.
 */
function validarUnidades(visita, filas) {
  if (!visita.sector) return []; // ya lo reporta la validación de la cabecera

  const errores = [];

  // Las estaciones de OTROS recorridos no se guardan: el formulario sortea
  // todas al abrirse, y sin esto una verificación de Insumos terminaba con una
  // tronera y una balanza cargadas que nadie miró.
  const delRecorrido = new Set(seccionesDeSector(visita.sector).map((s) => s.id));
  for (const s of SECCIONES) {
    if (!s.unidad || delRecorrido.has(s.id)) continue;
    visita[s.unidad.campo] = null;
    visita[`${s.unidad.campo}_sorteada`] = null;
    visita[`${s.unidad.campo}_motivo`] = null;
  }

  for (const s of seccionesDeSector(visita.sector)) {
    if (!s.unidad) continue;
    const { campo, nombre } = s.unidad;
    const revisada = filas.some((f) => f.Seccion === s.id && f.Respuesta !== NO_APLICA);

    if (revisada) {
      if (!visita[campo]) {
        errores.push(`${s.nombre}: falta indicar en qué ${nombre.toLowerCase()} se hizo la prueba.`);
      }
    } else {
      visita[campo] = null;
      visita[`${campo}_motivo`] = null;
    }
  }

  return errores;
}

function idDeParam(param) {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorHttp(400, 'Identificador de verificación no válido.');
  return id;
}

// ---------------------------------------------------------------------------
// Rutas (todas detrás de auth, montado en index.js)
// ---------------------------------------------------------------------------

// POST /api/verificaciones — Sistemas carga la verificación. Queda pendiente.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!roles.puedeCargar(req.user)) {
      throw new ErrorHttp(403, 'Tu usuario no puede cargar verificaciones: las carga Sistemas.');
    }

    const { datos: visita, errores: errCab } = validarCabecera(req.body?.visita);
    const { filas, errores: errResp } = validarRespuestas(req.body || {}, visita.sector);
    const errores = [...errCab, ...errResp, ...validarUnidades(visita, filas)];
    if (errores.length) throw new ErrorHttp(400, errores.join(' '));

    res.status(201).json(await store.guardar({ visita, respuestas: filas }, req.user));
  })
);

// GET /api/verificaciones?estado=Pendiente — listado para los paneles.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { estado } = req.query;
    if (estado && !Object.values(ESTADOS).includes(estado)) {
      throw new ErrorHttp(400, 'Estado no válido.');
    }
    res.json(await store.listar({ limit: 1000, estado: estado || null }));
  })
);

// GET /api/verificaciones/export — filas planas (una por chequeo) para el CSV.
// Va ANTES de /:id para que esa ruta no capture "export".
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    res.json(await store.listarPlano({ limit: 5000 }));
  })
);

// GET /api/verificaciones/:id — verificación con todas sus respuestas.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const verificacion = await store.obtener(idDeParam(req.params.id));
    if (!verificacion) throw new ErrorHttp(404, 'No encontramos esa verificación.');
    res.json({ ...verificacion, puedeFirmar: roles.puedeFirmar(req.user, verificacion.sector) });
  })
);

/**
 * POST /api/verificaciones/:id/conforme — firma del encargado del sector.
 *
 * La identidad del firmante sale de Easy Auth (nunca del body): nadie firma en
 * nombre de otro. Además:
 *  - sólo firma quien tiene rol de encargado del sector de la verificación;
 *  - por defecto no puede firmar quien la cargó (separación de tareas);
 *  - "observado" exige comentario, porque es el rechazo del conforme.
 */
router.post(
  '/:id/conforme',
  asyncHandler(async (req, res) => {
    const id = idDeParam(req.params.id);

    const decision = String(req.body?.decision || '').toLowerCase();
    if (!['conforme', 'observado'].includes(decision)) {
      throw new ErrorHttp(400, 'Indicá si das el conforme o si observás la verificación.');
    }
    const comentario = String(req.body?.comentario || '').trim().slice(0, 1000);
    if (decision === 'observado' && !comentario) {
      throw new ErrorHttp(400, 'Para observar la verificación hay que dejar un comentario.');
    }

    const verificacion = await store.obtener(id);
    if (!verificacion) throw new ErrorHttp(404, 'No encontramos esa verificación.');

    if (!roles.puedeFirmar(req.user, verificacion.sector)) {
      throw new ErrorHttp(403, `Tu usuario no puede firmar verificaciones del sector ${verificacion.sector}.`);
    }
    if (verificacion.CreadoPor === req.user.Email && !roles.permiteAutofirma()) {
      throw new ErrorHttp(403, 'El conforme lo da el encargado del sector, no quien cargó la verificación.');
    }
    if (verificacion.Estado !== ESTADOS.PENDIENTE) {
      throw new ErrorHttp(409, `La verificación ya fue marcada como "${verificacion.Estado}".`);
    }

    const estado = decision === 'conforme' ? ESTADOS.CONFORME : ESTADOS.OBSERVADO;
    const actualizada = await store.resolver(id, { estado, comentario }, req.user);
    if (!actualizada) throw new ErrorHttp(404, 'No encontramos esa verificación.');
    res.json(actualizada);
  })
);

module.exports = router;

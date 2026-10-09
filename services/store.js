/**
 * Capa de persistencia de las verificaciones de lectores.
 *
 * Cabecera en sistemas.VerificacionLectores y una fila por chequeo en
 * sistemas.VerificacionLectoresDetalle. El detalle guarda la pregunta tal como
 * se hizo (texto y número del Form), así que cambiar el cuestionario más
 * adelante no reescribe la historia ni pide una migración.
 *
 * El DDL vive en db/migrations (nunca se crea nada al arrancar) y se regenera
 * con `npm run migracion`.
 *
 * Con MODO_DEMO=true y sin base, guarda en memoria para poder mostrar el
 * circuito completo antes de tener Azure. Sin ese flag, si la base no está
 * disponible la API responde 503 en vez de aceptar datos que se van a perder.
 */
const { poolPromise, sql } = require('../config/db');
const { ErrorHttp } = require('../middlewares/errores');
const { CAMPOS_VISITA, CHECKS, FORM_META, ESTADOS } = require('../config/formConfig');

const TABLA = FORM_META.tabla;
const TABLA_DET = FORM_META.tablaDetalle;
const MODO_DEMO = process.env.MODO_DEMO === 'true';

/** Pool o, si no hay base, 503 (salvo en modo demo, donde devuelve null). */
async function conexion() {
  const pool = await poolPromise;
  if (!pool && !MODO_DEMO) {
    throw new ErrorHttp(503, 'La base no está disponible. Volvé a intentar en unos minutos.');
  }
  return pool;
}

/** Tipo mssql de cada campo de la cabecera, según su sqlType en formConfig.js. */
function mssqlTipo(sqlType) {
  if (sqlType === 'date') return sql.Date;
  if (sqlType === 'int') return sql.Int;
  if (sqlType === 'texto') return sql.NVarChar(1000);
  return sql.NVarChar(255);
}

// ---- Almacén en memoria (sólo MODO_DEMO) ----
const memCabeceras = [
  {
    Id: 2, fecha: '2026-10-08', sector: 'Empaque', turno: 'Mañana',
    observaciones_generales: '',
    Estado: ESTADOS.PENDIENTE,
    CreadoPor: 'sistemas@offalexpsa.ar', CreadoPorNombre: 'Operario de Sistemas',
    CreadoEn: '2026-10-08T12:40:00Z',
    ConformePor: null, ConformePorNombre: null, ConformeEn: null, ConformeComentario: null,
  },
  {
    Id: 1, fecha: '2026-10-07', sector: 'Insumos', turno: 'Tarde',
    observaciones_generales: '',
    Estado: ESTADOS.CONFORME,
    CreadoPor: 'sistemas@offalexpsa.ar', CreadoPorNombre: 'Operario de Sistemas',
    CreadoEn: '2026-10-07T15:10:00Z',
    ConformePor: 'encargado.insumos@offalexpsa.ar', ConformePorNombre: 'Encargado de Insumos',
    ConformeEn: '2026-10-07T17:02:00Z', ConformeComentario: 'Conforme.',
  },
];

// Detalle de ejemplo: la verificación 2 tiene una falla en la tronera.
let memSeqDet = 0;
const memDetalles = [2, 1].flatMap((verificacionId) =>
  CHECKS.map((c, i) => {
    const falla = verificacionId === 2 && c.id === 'tronera_validacion';
    return {
      Id: ++memSeqDet,
      VerificacionId: verificacionId,
      Orden: i + 1,
      Seccion: c.seccion,
      PreguntaId: c.id,
      PreguntaNro: c.nro,
      Pregunta: c.texto,
      Respuesta: falla ? 'No' : 'Si',
      Problematica: falla ? 'Pasó una caja con otro artículo y no la rechazó.' : null,
      EsFalla: falla,
    };
  })
);
let memSeqCab = 2;

// ---- API pública ----

/**
 * Guarda una verificación completa (cabecera + los chequeos) en una
 * transacción: o entra todo o no entra nada.
 */
async function guardar({ visita, respuestas }, user) {
  const pool = await conexion();

  if (!pool) {
    const cab = {
      Id: ++memSeqCab,
      ...visita,
      Estado: ESTADOS.PENDIENTE,
      CreadoPor: user.Email,
      CreadoPorNombre: user.Nombre || null,
      CreadoEn: new Date().toISOString(),
      ConformePor: null, ConformePorNombre: null, ConformeEn: null, ConformeComentario: null,
    };
    memCabeceras.unshift(cab);
    respuestas.forEach((r, i) => {
      memDetalles.push({ Id: ++memSeqDet, VerificacionId: cab.Id, Orden: i + 1, ...r });
    });
    return { ...cab, respuestas: memDetalles.filter((d) => d.VerificacionId === cab.Id) };
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const reqCab = new sql.Request(tx);
    CAMPOS_VISITA.forEach((c) => reqCab.input(c.name, mssqlTipo(c.sqlType), visita[c.name]));
    reqCab.input('Estado', sql.NVarChar(20), ESTADOS.PENDIENTE);
    reqCab.input('CreadoPor', sql.NVarChar(255), user.Email);
    reqCab.input('CreadoPorNombre', sql.NVarChar(255), user.Nombre || null);

    const cols = CAMPOS_VISITA.map((c) => `[${c.name}]`).join(', ');
    const vals = CAMPOS_VISITA.map((c) => `@${c.name}`).join(', ');
    const rCab = await reqCab.query(
      `INSERT INTO ${TABLA} (${cols}, [Estado], [CreadoPor], [CreadoPorNombre])
       OUTPUT INSERTED.*
       VALUES (${vals}, @Estado, @CreadoPor, @CreadoPorNombre);`
    );
    const cabecera = rCab.recordset[0];

    const detalle = [];
    for (let i = 0; i < respuestas.length; i++) {
      const r = respuestas[i];
      const rDet = await new sql.Request(tx)
        .input('VerificacionId', sql.Int, cabecera.Id)
        .input('Orden', sql.Int, i + 1)
        .input('Seccion', sql.NVarChar(100), r.Seccion)
        .input('PreguntaId', sql.NVarChar(100), r.PreguntaId)
        .input('PreguntaNro', sql.Int, r.PreguntaNro)
        .input('Pregunta', sql.NVarChar(500), r.Pregunta)
        .input('Respuesta', sql.NVarChar(20), r.Respuesta)
        .input('Problematica', sql.NVarChar(1000), r.Problematica)
        .input('EsFalla', sql.Bit, r.EsFalla)
        .query(
          `INSERT INTO ${TABLA_DET}
             ([VerificacionId], [Orden], [Seccion], [PreguntaId], [PreguntaNro], [Pregunta],
              [Respuesta], [Problematica], [EsFalla])
           OUTPUT INSERTED.*
           VALUES (@VerificacionId, @Orden, @Seccion, @PreguntaId, @PreguntaNro, @Pregunta,
                   @Respuesta, @Problematica, @EsFalla);`
        );
      detalle.push(rDet.recordset[0]);
    }

    await tx.commit();
    return { ...cabecera, respuestas: detalle };
  } catch (err) {
    try { await tx.rollback(); } catch { /* la transacción ya estaba abortada */ }
    throw err;
  }
}

/** Lista cabeceras con cuántos chequeos fallaron en cada una. */
async function listar({ limit = 500, estado = null } = {}) {
  const pool = await conexion();

  if (!pool) {
    return memCabeceras
      .filter((c) => !estado || c.Estado === estado)
      .slice(0, limit)
      .map((c) => ({
        ...c,
        Fallas: memDetalles.filter((d) => d.VerificacionId === c.Id && d.EsFalla).length,
      }));
  }

  const r = await pool
    .request()
    .input('limit', sql.Int, limit)
    .input('estado', sql.NVarChar(20), estado)
    .query(
      `SELECT TOP (@limit) c.*,
              (SELECT COUNT(*) FROM ${TABLA_DET} d
                WHERE d.VerificacionId = c.Id AND d.EsFalla = 1) AS Fallas
       FROM ${TABLA} c
       WHERE (@estado IS NULL OR c.Estado = @estado)
       ORDER BY c.Id DESC;`
    );
  return r.recordset;
}

/**
 * Filas planas para el export: una por chequeo, con los datos de la cabecera y
 * del conforme repetidos.
 */
async function listarPlano({ limit = 5000 } = {}) {
  const pool = await conexion();

  if (!pool) {
    return memDetalles
      .map((d) => {
        const cab = memCabeceras.find((c) => c.Id === d.VerificacionId);
        return cab ? { ...cab, ...d, Id: cab.Id, DetalleId: d.Id } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.Id - a.Id || a.Orden - b.Orden)
      .slice(0, limit);
  }

  const colsCab = CAMPOS_VISITA.map((c) => `c.[${c.name}]`).join(', ');
  const r = await pool.request().input('limit', sql.Int, limit).query(
    `SELECT TOP (@limit)
            c.Id, ${colsCab}, c.Estado, c.CreadoPor, c.CreadoPorNombre, c.CreadoEn,
            c.ConformePor, c.ConformePorNombre, c.ConformeEn, c.ConformeComentario,
            d.Id AS DetalleId, d.Orden, d.Seccion, d.PreguntaId, d.PreguntaNro, d.Pregunta,
            d.Respuesta, d.Problematica, d.EsFalla
       FROM ${TABLA} c
       JOIN ${TABLA_DET} d ON d.VerificacionId = c.Id
      ORDER BY c.Id DESC, d.Orden;`
  );
  return r.recordset;
}

/** Trae una verificación con todas sus respuestas. */
async function obtener(id) {
  const pool = await conexion();

  if (!pool) {
    const cab = memCabeceras.find((c) => c.Id === Number(id));
    if (!cab) return null;
    return {
      ...cab,
      respuestas: memDetalles
        .filter((d) => d.VerificacionId === cab.Id)
        .sort((a, b) => a.Orden - b.Orden),
    };
  }

  const rCab = await pool.request().input('id', sql.Int, id).query(`SELECT * FROM ${TABLA} WHERE Id = @id;`);
  const cab = rCab.recordset[0];
  if (!cab) return null;

  const rDet = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`SELECT * FROM ${TABLA_DET} WHERE VerificacionId = @id ORDER BY Orden;`);
  return { ...cab, respuestas: rDet.recordset };
}

/**
 * Firma el conforme (o lo observa). El UPDATE es condicional sobre
 * Estado = 'Pendiente': si dos encargados entran a la vez, el segundo recibe
 * 409 en vez de pisar la firma del primero.
 */
async function resolver(id, { estado, comentario }, user) {
  const pool = await conexion();

  if (!pool) {
    const cab = memCabeceras.find((c) => c.Id === Number(id));
    if (!cab) return null;
    if (cab.Estado !== ESTADOS.PENDIENTE) {
      throw new ErrorHttp(409, `La verificación ya fue marcada como "${cab.Estado}".`);
    }
    cab.Estado = estado;
    cab.ConformePor = user.Email;
    cab.ConformePorNombre = user.Nombre || null;
    cab.ConformeEn = new Date().toISOString();
    cab.ConformeComentario = comentario || null;
    return obtener(id);
  }

  const r = await pool
    .request()
    .input('id', sql.Int, id)
    .input('estado', sql.NVarChar(20), estado)
    .input('email', sql.NVarChar(255), user.Email)
    .input('nombre', sql.NVarChar(255), user.Nombre || null)
    .input('comentario', sql.NVarChar(1000), comentario || null)
    .input('pendiente', sql.NVarChar(20), ESTADOS.PENDIENTE)
    .query(
      `UPDATE ${TABLA}
          SET Estado = @estado,
              ConformePor = @email,
              ConformePorNombre = @nombre,
              ConformeEn = SYSUTCDATETIME(),
              ConformeComentario = @comentario
       OUTPUT INSERTED.Id
        WHERE Id = @id AND Estado = @pendiente;`
    );

  if (!r.recordset.length) {
    // No se actualizó: o no existe, o ya la resolvió otro.
    const actual = await obtener(id);
    if (!actual) return null;
    throw new ErrorHttp(409, `La verificación ya fue marcada como "${actual.Estado}".`);
  }
  return obtener(id);
}

module.exports = { guardar, listar, listarPlano, obtener, resolver };

import { useMemo, useRef, useState } from 'react';
import Campo from './Campo';

const hoy = () => new Date().toISOString().slice(0, 10);

/** Sortea la unidad de cada estación que tenga más de una (tronera, balanza…). */
function sortearUnidades(secciones) {
  const v = {};
  for (const s of secciones) {
    if (!s.unidad) continue;
    const n = String(1 + Math.floor(Math.random() * s.unidad.cantidad));
    v[`${s.unidad.campo}_sorteada`] = n;
    v[s.unidad.campo] = n; // arranca en la sorteada; se puede cambiar con motivo
    v[`${s.unidad.campo}_motivo`] = '';
  }
  return v;
}

function cabeceraInicial(campos, secciones) {
  const v = Object.fromEntries(campos.map((c) => [c.name, '']));
  if ('fecha' in v) v.fecha = hoy();
  return { ...v, ...sortearUnidades(secciones) };
}

const respuestasIniciales = (checks) =>
  Object.fromEntries(checks.map((c) => [c.id, { respuesta: '', problematica: '' }]));

/** Clase del pad según lo que significa esa respuesta para este chequeo. */
function clasePad(check, opcion, noAplica) {
  if (opcion === check.esperado) return 'on-ok';
  if (opcion === noAplica) return 'on-neutro';
  return 'on-mal';
}

/**
 * Una pregunta: el texto y los pads grandes (Sí / No / No aplica).
 * El campo de texto sólo aparece cuando la respuesta no es la esperada:
 * obligatorio si el lector falló, opcional para aclarar un "No aplica".
 * Así se completa de un toque por pregunta.
 */
function Chequeo({ check, valor, opciones, noAplica, onRespuesta, onProblematica }) {
  const respondida = !!valor.respuesta;
  const esNoAplica = valor.respuesta === noAplica;
  const falla = respondida && valor.respuesta !== check.esperado && !esNoAplica;
  const pideTexto = respondida && valor.respuesta !== check.esperado;
  const ayudaId = check.ayuda ? `ayuda-${check.id}` : undefined;

  return (
    <div className={`chequeo ${falla ? 'es-falla' : ''}`}>
      <div className="chequeo-texto">
        <p className="chequeo-pregunta">
          <span className="chequeo-nro">{check.nro}</span> {check.texto}
        </p>
        {check.ayuda && <p className="campo-ayuda" id={ayudaId}>{check.ayuda}</p>}
      </div>

      <div className="pads" role="group" aria-label={check.texto} aria-describedby={ayudaId}>
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            className={`pad ${valor.respuesta === o ? clasePad(check, o, noAplica) : ''}`}
            aria-pressed={valor.respuesta === o}
            onClick={() => onRespuesta(o)}
          >
            {o === 'Si' ? 'Sí' : o}
          </button>
        ))}
      </div>

      {pideTexto && (
        <div className="campo-grupo ancho">
          <label className="campo-etq" htmlFor={`prob-${check.id}`}>
            {esNoAplica ? (
              <>
                Por qué no aplica <span className="campo-ayuda">(opcional)</span>
              </>
            ) : (
              <>
                Especificar problemática <span className="req" aria-hidden="true">*</span>
                <span className="campo-ayuda"> (pregunta {check.nroProblematica} del formulario)</span>
              </>
            )}
          </label>
          <textarea
            id={`prob-${check.id}`}
            className="campo"
            rows={2}
            maxLength={1000}
            placeholder={esNoAplica ? 'Por ejemplo: la línea no tiene esta estación' : 'Qué pasó y qué se hizo'}
            value={valor.problematica}
            onChange={(e) => onProblematica(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Carga de la verificación: primero el recorrido, después sus estaciones.
 *
 * Una verificación es UN recorrido (un sector), no la planta entera: elegido el
 * sector se muestran sólo sus estaciones, en un acordeón que abre la que se
 * está revisando. Antes estaban las seis desplegadas y era un scroll eterno.
 *
 * Las estaciones, las preguntas y las unidades salen del servidor
 * (config/formConfig.js): acá no hay nada escrito a mano.
 */
export default function VerificacionForm({ config, onSubmit }) {
  const {
    campos_visita: camposVisita, secciones, checks, respuestas: opciones, no_aplica: noAplica,
  } = config;

  const [cabecera, setCabecera] = useState(() => cabeceraInicial(camposVisita, secciones));
  const [valores, setValores] = useState(() => respuestasIniciales(checks));
  const [abierta, setAbierta] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState([]);
  const refsSeccion = useRef({});

  // El recorrido elegido manda: define qué estaciones se responden y, después,
  // qué encargado puede firmar.
  const sector = cabecera.sector;
  const seccionesDelSector = useMemo(
    () => (sector ? secciones.filter((s) => s.sector === sector) : []),
    [secciones, sector]
  );
  const checksDelSector = useMemo(() => {
    const ids = new Set(seccionesDelSector.map((s) => s.id));
    return checks.filter((c) => ids.has(c.seccion));
  }, [checks, seccionesDelSector]);

  // Campos generales (arriba) y campos propios de cada estación (adentro).
  const camposGenerales = useMemo(() => camposVisita.filter((c) => !c.seccion), [camposVisita]);
  const camposPorSeccion = useMemo(() => {
    const m = {};
    camposVisita.forEach((c) => {
      if (!c.seccion || c.type === 'oculto') return;
      (m[c.seccion] ||= []).push(c);
    });
    return m;
  }, [camposVisita]);

  const respondidas = useMemo(
    () => checksDelSector.filter((c) => valores[c.id]?.respuesta).length,
    [checksDelSector, valores]
  );
  const fallas = useMemo(
    () =>
      checksDelSector.filter((c) => {
        const r = valores[c.id]?.respuesta;
        return r && r !== c.esperado && r !== noAplica;
      }).length,
    [checksDelSector, valores, noAplica]
  );

  /** Estado de cada estación, para la línea cerrada del acordeón. */
  const porSeccion = useMemo(
    () =>
      seccionesDelSector.map((s) => {
        const suyos = checks.filter((c) => c.seccion === s.id);
        const contestados = suyos.filter((c) => valores[c.id]?.respuesta);
        return {
          ...s,
          checks: suyos,
          total: suyos.length,
          hechos: contestados.length,
          fallas: contestados.filter(
            (c) => valores[c.id].respuesta !== c.esperado && valores[c.id].respuesta !== noAplica
          ).length,
          // Revisada = alguna respuesta distinta de "No aplica".
          revisada: contestados.some((c) => valores[c.id].respuesta !== noAplica),
          sinAplicar: contestados.length === suyos.length && contestados.every(
            (c) => valores[c.id].respuesta === noAplica
          ),
        };
      }),
    [seccionesDelSector, checks, valores, noAplica]
  );

  /**
   * Cambiar el recorrido borra lo respondido: las preguntas son otras. Y se
   * vuelve a sortear, para que el sorteo sea del recorrido que se va a hacer.
   */
  function setCampoGeneral(name, v) {
    if (name === 'sector' && v !== cabecera.sector) {
      setCabecera((prev) => ({ ...prev, sector: v, ...sortearUnidades(secciones) }));
      setValores(respuestasIniciales(checks));
      const primera = secciones.find((s) => s.sector === v);
      setAbierta(primera ? primera.id : null);
      setErrores([]);
      return;
    }
    setCabecera((prev) => ({ ...prev, [name]: v }));
  }

  function setRespuesta(id, respuesta) {
    setValores((prev) => ({ ...prev, [id]: { ...prev[id], respuesta } }));
  }
  function setProblematica(id, problematica) {
    setValores((prev) => ({ ...prev, [id]: { ...prev[id], problematica } }));
  }

  // No hay atajo para responder todo de una: cada chequeo es una prueba que
  // alguien tiene que hacer en la línea, y un botón que los marca todos OK
  // invita a firmar sin haberla hecho. Se saca a pedido de Sistemas (2026-11-02).

  function limpiar() {
    setValores(respuestasIniciales(checks));
  }

  /** Sólo las respuestas del recorrido elegido: las demás no se mandan. */
  function respuestasAEnviar() {
    return Object.fromEntries(checksDelSector.map((c) => [c.id, valores[c.id]]));
  }

  function abrir(id) {
    setAbierta((actual) => (actual === id ? null : id));
    // Deja el encabezado de la estación a la vista al abrirla.
    requestAnimationFrame(() => refsSeccion.current[id]?.scrollIntoView({ block: 'nearest' }));
  }

  function siguiente(id) {
    const i = secciones.findIndex((s) => s.id === id);
    const prox = secciones[i + 1];
    if (prox) abrir(prox.id);
    else setAbierta(null);
  }

  function validar() {
    const errs = [];
    camposGenerales.filter((c) => c.required).forEach((c) => {
      if (String(cabecera[c.name] ?? '').trim() === '') errs.push(`Falta "${c.label}".`);
    });

    if (!sector) errs.push('Elegí el recorrido que vas a hacer.');

    checksDelSector.forEach((c) => {
      const v = valores[c.id] || {};
      if (!v.respuesta) {
        errs.push(`Falta responder la pregunta ${c.nro}.`);
      } else if (v.respuesta !== c.esperado && v.respuesta !== noAplica && !v.problematica.trim()) {
        errs.push(`Pregunta ${c.nro}: falta especificar la problemática.`);
      }
    });

    // Unidad verificada: obligatoria sólo si la estación se revisó, y si no es
    // la sorteada hay que decir por qué.
    porSeccion.forEach((s) => {
      if (!s.unidad || !s.revisada) return;
      const { campo, nombre } = s.unidad;
      const elegida = String(cabecera[campo] ?? '');
      if (!elegida) {
        errs.push(`${s.nombre}: falta indicar en qué ${nombre.toLowerCase()} se hizo la prueba.`);
        return;
      }
      if (elegida !== String(cabecera[`${campo}_sorteada`] ?? '')
          && !String(cabecera[`${campo}_motivo`] ?? '').trim()) {
        errs.push(`${s.nombre}: cambiaste de ${nombre.toLowerCase()}, falta el motivo.`);
      }
    });

    return errs;
  }

  async function submit(e) {
    e.preventDefault();
    const errs = validar();
    if (errs.length) { setErrores(errs); return; }
    setErrores([]);
    try {
      setEnviando(true);
      await onSubmit({ visita: cabecera, respuestas: respuestasAEnviar() });
      // Verificación nueva: se sortean unidades nuevas y se vuelve a elegir recorrido.
      setCabecera(cabeceraInicial(camposVisita, secciones));
      setValores(respuestasIniciales(checks));
      setAbierta(null);
    } catch (err) {
      setErrores([err.message]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <section className="panel bloque">
        <div className="panel-cab">
          <h2 className="panel-titulo">Datos de la verificación</h2>
        </div>
        <div className="form-grid">
          {camposGenerales.map((c) => (
            <Campo
              key={c.name}
              campo={c}
              id={`v_${c.name}`}
              valor={cabecera[c.name]}
              onChange={(v) => setCampoGeneral(c.name, v)}
            />
          ))}
        </div>
      </section>

      {!sector ? (
        <div className="panel bloque estado">
          <p className="estado-tit">Elegí el recorrido para arrancar</p>
          <p>Arriba, en “Recorrido que vas a hacer”. Cada recorrido tiene sus propias estaciones.</p>
        </div>
      ) : (
      <>
      <div className="avance bloque">
        <div className="avance-txt">
          <strong>{respondidas} de {checksDelSector.length}</strong> respondidas
          {fallas > 0 && <span className="chip chip-aviso">{fallas} con problema</span>}
        </div>
        <div className="avance-acciones">
          <button type="button" className="btn btn-fantasma" onClick={limpiar} disabled={!respondidas}>
            Limpiar respuestas
          </button>
        </div>
      </div>

      <div className="acordeon bloque">
        {porSeccion.map((s) => {
          const abiertaEsta = abierta === s.id;
          const elegida = s.unidad ? String(cabecera[s.unidad.campo] ?? '') : '';
          const sorteada = s.unidad ? String(cabecera[`${s.unidad.campo}_sorteada`] ?? '') : '';
          const cambiada = !!s.unidad && !!elegida && elegida !== sorteada;

          return (
            <div className={`acordeon-item ${abiertaEsta ? 'abierta' : ''}`} key={s.id}>
              <button
                type="button"
                className="acordeon-cab"
                aria-expanded={abiertaEsta}
                ref={(el) => { refsSeccion.current[s.id] = el; }}
                onClick={() => abrir(s.id)}
              >
                <span className="acordeon-nombre">
                  {s.nombre}
                  {s.unidad && elegida && (
                    <span className={`chip ${cambiada ? 'chip-aviso' : 'chip-info'}`}>
                      {s.unidad.nombre} {elegida}
                      {cambiada ? ' (cambiada)' : ''}
                    </span>
                  )}
                </span>
                <span className="acordeon-estado">
                  {s.fallas > 0 && <span className="chip chip-mal">{s.fallas} con problema</span>}
                  {s.sinAplicar && <span className="chip">No aplica</span>}
                  <span className={`acordeon-conteo ${s.hechos === s.total ? 'completa' : ''}`}>
                    {s.hechos}/{s.total}
                  </span>
                  <span className="acordeon-flecha" aria-hidden="true">{abiertaEsta ? '▴' : '▾'}</span>
                </span>
              </button>

              {abiertaEsta && (
                <div className="acordeon-cuerpo">
                  {/* Unidad sorteada: qué tronera / armadora / balanza toca. */}
                  {s.unidad && (
                    <div className="unidad">
                      <p className="unidad-sorteo">
                        Toca <strong>{s.unidad.nombre} {sorteada}</strong>
                        <span className="panel-sub"> · salió sorteada</span>
                      </p>
                      <div className="form-grid">
                        {(camposPorSeccion[s.id] || [])
                          // El motivo sólo cuando de verdad se cambió de unidad.
                          .filter((c) => !c.exigidoSiDistinto || cambiada)
                          .map((c) => (
                            <Campo
                              key={c.name}
                              campo={c.exigidoSiDistinto ? { ...c, required: true } : c}
                              id={`v_${c.name}`}
                              valor={cabecera[c.name]}
                              onChange={(v) => setCabecera((prev) => ({ ...prev, [c.name]: v }))}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {s.checks.map((c) => (
                    <Chequeo
                      key={c.id}
                      check={c}
                      valor={valores[c.id]}
                      opciones={opciones}
                      noAplica={noAplica}
                      onRespuesta={(v) => setRespuesta(c.id, v)}
                      onProblematica={(v) => setProblematica(c.id, v)}
                    />
                  ))}

                  <div className="acordeon-pie">
                    <button type="button" className="btn" onClick={() => siguiente(s.id)}>
                      Siguiente estación
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      </>
      )}

      {errores.length > 0 && (
        <div className="alerta alerta-mal lista-errores" role="alert">
          <div>{errores.map((msg, i) => <div key={i}>• {msg}</div>)}</div>
        </div>
      )}

      <div className="form-acciones">
        <button
          className={`btn btn-primario btn-grande ${enviando ? 'cargando' : ''}`}
          type="submit"
          disabled={enviando}
        >
          Guardar y enviar a conforme
        </button>
      </div>
    </form>
  );
}

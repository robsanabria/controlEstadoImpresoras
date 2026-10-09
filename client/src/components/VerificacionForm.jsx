import { useMemo, useState } from 'react';
import Campo from './Campo';

const hoy = () => new Date().toISOString().slice(0, 10);

function cabeceraInicial(campos) {
  const v = Object.fromEntries(campos.map((c) => [c.name, '']));
  if ('fecha' in v) v.fecha = hoy();
  return v;
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
 * Carga de la verificación: cabecera + los chequeos agrupados por sección.
 * Las preguntas salen del servidor (config/formConfig.js): acá no hay ninguna
 * pregunta escrita a mano.
 */
export default function VerificacionForm({ config, onSubmit }) {
  const {
    campos_visita: camposVisita, secciones, checks, respuestas: opciones, no_aplica: noAplica,
  } = config;

  const [cabecera, setCabecera] = useState(() => cabeceraInicial(camposVisita));
  const [valores, setValores] = useState(() => respuestasIniciales(checks));
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState([]);

  const respondidas = useMemo(
    () => checks.filter((c) => valores[c.id]?.respuesta).length,
    [checks, valores]
  );
  const fallas = useMemo(
    () =>
      checks.filter((c) => {
        const r = valores[c.id]?.respuesta;
        return r && r !== c.esperado && r !== noAplica;
      }).length,
    [checks, valores, noAplica]
  );

  const porSeccion = useMemo(
    () => secciones.map((s) => ({ ...s, checks: checks.filter((c) => c.seccion === s.id) })),
    [secciones, checks]
  );

  function setRespuesta(id, respuesta) {
    setValores((prev) => ({ ...prev, [id]: { ...prev[id], respuesta } }));
  }
  function setProblematica(id, problematica) {
    setValores((prev) => ({ ...prev, [id]: { ...prev[id], problematica } }));
  }

  /** Atajo del caso normal: anduvo todo. Después se corrige lo que falló. */
  function todoOk() {
    setValores((prev) =>
      Object.fromEntries(
        checks.map((c) => [c.id, { respuesta: c.esperado, problematica: prev[c.id]?.problematica || '' }])
      )
    );
  }

  function limpiar() {
    setValores(respuestasIniciales(checks));
  }

  function validar() {
    const errs = [];
    camposVisita.filter((c) => c.required).forEach((c) => {
      if (String(cabecera[c.name] ?? '').trim() === '') errs.push(`Falta "${c.label}".`);
    });
    checks.forEach((c) => {
      const v = valores[c.id] || {};
      if (!v.respuesta) {
        errs.push(`Falta responder la pregunta ${c.nro}.`);
      } else if (v.respuesta !== c.esperado && v.respuesta !== noAplica && !v.problematica.trim()) {
        errs.push(`Pregunta ${c.nro}: falta especificar la problemática.`);
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
      await onSubmit({ visita: cabecera, respuestas: valores });
      setCabecera(cabeceraInicial(camposVisita));
      setValores(respuestasIniciales(checks));
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
          {camposVisita.map((c) => (
            <Campo
              key={c.name}
              campo={c}
              id={`v_${c.name}`}
              valor={cabecera[c.name]}
              onChange={(v) => setCabecera((prev) => ({ ...prev, [c.name]: v }))}
            />
          ))}
        </div>
      </section>

      <div className="avance bloque">
        <div className="avance-txt">
          <strong>{respondidas} de {checks.length}</strong> respondidas
          {fallas > 0 && <span className="chip chip-aviso">{fallas} con problema</span>}
        </div>
        <div className="avance-acciones">
          <button type="button" className="btn" onClick={todoOk}>Anduvo todo bien</button>
          <button type="button" className="btn btn-fantasma" onClick={limpiar} disabled={!respondidas}>
            Limpiar respuestas
          </button>
        </div>
      </div>

      {porSeccion.map((s) => (
        <section className="panel bloque" key={s.id}>
          <div className="panel-cab">
            <h2 className="panel-titulo">{s.nombre}</h2>
            <span className="panel-sub">
              {s.checks.filter((c) => valores[c.id]?.respuesta).length}/{s.checks.length}
            </span>
          </div>
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
        </section>
      ))}

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

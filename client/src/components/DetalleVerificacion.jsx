import { useMemo, useState } from 'react';

export function fmtFecha(v) {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('es-AR');
}

export function fmtFechaHora(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Color del chip de una respuesta: verde si anduvo, rojo si falló y neutro para
 * "No aplica" (que no es ni bueno ni malo).
 */
function chipRespuesta(fila, noAplica) {
  if (fila.EsFalla) return 'chip-mal';
  if (fila.Respuesta === noAplica) return '';
  return 'chip-ok';
}

export function EstadoChip({ estado }) {
  const clase =
    estado === 'Conforme' ? 'chip chip-ok' : estado === 'Observado' ? 'chip chip-aviso' : 'chip chip-info';
  return <span className={clase}>{estado}</span>;
}

/**
 * Detalle de una verificación: cabecera, las respuestas agrupadas por sección y,
 * si está pendiente, el bloque de conforme del encargado.
 *
 * Nadie elige "a nombre de quién" firma: el firmante es el usuario de la sesión
 * y el servidor vuelve a validar el permiso y el sector.
 */
export default function DetalleVerificacion({ verificacion, config, onFirmar, puedeFirmarSector }) {
  const { campos_visita: camposVisita, secciones, no_aplica: noAplica } = config;
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const respuestas = verificacion.respuestas || [];
  const fallas = useMemo(() => respuestas.filter((r) => r.EsFalla).length, [respuestas]);

  // Agrupa por sección respetando el orden del formulario. Si una respuesta vieja
  // tiene una sección que ya no existe, igual se muestra al final.
  const grupos = useMemo(() => {
    const nombre = Object.fromEntries(secciones.map((s) => [s.id, s.nombre]));
    const porId = new Map();
    respuestas.forEach((r) => {
      if (!porId.has(r.Seccion)) porId.set(r.Seccion, []);
      porId.get(r.Seccion).push(r);
    });
    return [...porId.entries()].map(([id, filas]) => ({ id, nombre: nombre[id] || id, filas }));
  }, [respuestas, secciones]);

  const pendiente = verificacion.Estado === 'Pendiente';
  // El servidor es el que decide; esto sólo evita mostrar botones que van a fallar.
  const puedeFirmar = pendiente && (verificacion.puedeFirmar ?? puedeFirmarSector);

  async function firmar(decision) {
    setError(null);
    if (decision === 'observado' && !comentario.trim()) {
      setError('Para observar la verificación hay que dejar un comentario.');
      return;
    }
    try {
      setEnviando(true);
      await onFirmar(verificacion.Id, decision, comentario.trim());
      setComentario('');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="panel bloque" aria-label={`Detalle de la verificación ${verificacion.Id}`}>
      <div className="panel-cab">
        <h2 className="panel-titulo">
          Verificación #{verificacion.Id} · {verificacion.sector} · {fmtFecha(verificacion.fecha)}
        </h2>
        <EstadoChip estado={verificacion.Estado} />
        <span className={`chip ${fallas ? 'chip-mal' : 'chip-ok'}`}>
          {fallas === 0 ? 'Sin problemas' : `${fallas} con problema`}
        </span>
        <span className="panel-sub der">
          Cargada por {verificacion.CreadoPorNombre || verificacion.CreadoPor} ·{' '}
          {fmtFechaHora(verificacion.CreadoEn)}
        </span>
      </div>

      <dl className="ficha">
        {camposVisita.map((c) => (
          <div className="ficha-item" key={c.name}>
            <dt>{c.label}</dt>
            <dd>{c.type === 'date' ? fmtFecha(verificacion[c.name]) : verificacion[c.name] || '—'}</dd>
          </div>
        ))}
      </dl>

      {grupos.map((g) => (
        <div className="grupo-respuestas" key={g.id}>
          <h3 className="grupo-tit">{g.nombre}</h3>
          {g.filas.map((r) => (
            <div className={`respuesta ${r.EsFalla ? 'es-falla' : ''}`} key={r.Id ?? r.Orden}>
              <p className="respuesta-pregunta">
                <span className="chequeo-nro">{r.PreguntaNro}</span> {r.Pregunta}
              </p>
              <span className={`chip ${chipRespuesta(r, noAplica)}`}>
                {r.Respuesta === 'Si' ? 'Sí' : r.Respuesta}
              </span>
              {r.Problematica && <p className="cita">“{r.Problematica}”</p>}
            </div>
          ))}
        </div>
      ))}

      {pendiente ? (
        <div className="conforme">
          <h3 className="panel-titulo">Conforme del encargado de {verificacion.sector}</h3>
          {puedeFirmar ? (
            <>
              <p className="panel-sub">
                Firmás con el usuario de tu sesión: queda registrado tu nombre, tu dirección de correo y
                la fecha y hora.
              </p>
              <div className="campo-grupo">
                <label className="campo-etq" htmlFor="comentario-conforme">
                  Comentario <span className="panel-sub">(obligatorio si observás la verificación)</span>
                </label>
                <textarea
                  id="comentario-conforme"
                  className="campo"
                  rows={2}
                  maxLength={1000}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
              </div>
              {error && <div className="alerta alerta-mal" role="alert">{error}</div>}
              <div className="form-acciones">
                <button className="btn btn-peligro" disabled={enviando} onClick={() => firmar('observado')}>
                  Observar
                </button>
                <button
                  className={`btn btn-primario btn-grande ${enviando ? 'cargando' : ''}`}
                  disabled={enviando}
                  onClick={() => firmar('conforme')}
                >
                  Dar conforme
                </button>
              </div>
            </>
          ) : (
            <div className="alerta alerta-info">
              Esta verificación espera el conforme del encargado de {verificacion.sector}. Tu usuario no
              puede firmarla.
            </div>
          )}
        </div>
      ) : (
        <div className={`alerta ${verificacion.Estado === 'Conforme' ? 'alerta-ok' : 'alerta-aviso'}`}>
          <div>
            <strong>
              {verificacion.Estado === 'Conforme' ? 'Conforme firmado por ' : 'Observada por '}
              {verificacion.ConformePorNombre || verificacion.ConformePor}
            </strong>
            <span className="panel-sub"> · {fmtFechaHora(verificacion.ConformeEn)}</span>
            {verificacion.ConformeComentario && <div className="cita">“{verificacion.ConformeComentario}”</div>}
          </div>
        </div>
      )}
    </section>
  );
}

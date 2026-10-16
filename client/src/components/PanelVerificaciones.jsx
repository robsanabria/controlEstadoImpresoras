import { useMemo, useState } from 'react';
import DetalleVerificacion, { EstadoChip, fmtFecha, fmtFechaHora } from './DetalleVerificacion';

/**
 * Listado de verificaciones + detalle de la seleccionada.
 * Lo usan la bandeja de conforme (sólo pendientes) y el historial (todas, con
 * búsqueda y export).
 */
export default function PanelVerificaciones({
  config,
  filas,
  seleccionada,
  cargandoDetalle,
  onSeleccionar,
  onFirmar,
  onRefrescar,
  refrescando,
  onExportar,
  conBusqueda = false,
  vacioTxt = 'No hay verificaciones.',
  puedeFirmarSector,
  onPedirConforme,
}) {
  const [q, setQ] = useState('');
  const [exportando, setExportando] = useState(false);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return filas;
    return filas.filter((f) =>
      [f.Id, f.sector, f.turno, f.Estado, f.CreadoPorNombre, f.CreadoPor, f.ConformePorNombre, f.fecha]
        .some((v) => String(v ?? '').toLowerCase().includes(t))
    );
  }, [q, filas]);

  async function exportar() {
    try {
      setExportando(true);
      await onExportar();
    } finally {
      setExportando(false);
    }
  }

  return (
    <div>
      <div className="filtros">
        {conBusqueda && (
          <div className="campo-grupo buscar">
            <label className="campo-etq" htmlFor="buscar">Buscar</label>
            <input
              id="buscar"
              className="campo"
              placeholder="Sector, estado, quién la cargó…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        )}
        <button className="btn" onClick={onRefrescar} disabled={refrescando}>
          {refrescando ? 'Actualizando…' : 'Actualizar'}
        </button>
        {onExportar && (
          <button className="btn" onClick={exportar} disabled={exportando || !filas.length}>
            {exportando ? 'Generando…' : 'Exportar CSV'}
          </button>
        )}
      </div>

      <p className="panel-sub conteo">
        {filtradas.length} verificaci{filtradas.length === 1 ? 'ón' : 'ones'}
      </p>

      <div className="tabla-marco">
        <table className="tabla">
          <thead>
            <tr>
              <th>Verificación</th>
              <th>Fecha</th>
              <th>Sector</th>
              <th>Turno</th>
              <th>Resultado</th>
              <th>Estado</th>
              <th>Cargada por</th>
              <th>Conforme</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtradas.map((f) => (
              <tr key={f.Id} className={seleccionada?.Id === f.Id ? 'fila-sel' : ''}>
                <td data-etq="Verificación">#{f.Id}</td>
                <td data-etq="Fecha">{fmtFecha(f.fecha)}</td>
                <td data-etq="Sector">{f.sector}</td>
                <td data-etq="Turno">{f.turno || '—'}</td>
                <td data-etq="Resultado">
                  <span className={`chip ${f.Fallas ? 'chip-mal' : 'chip-ok'}`}>
                    {f.Fallas ? `${f.Fallas} con problema` : 'Sin problemas'}
                  </span>
                </td>
                <td data-etq="Estado"><EstadoChip estado={f.Estado} /></td>
                <td data-etq="Cargada por">{f.CreadoPorNombre || f.CreadoPor}</td>
                <td data-etq="Conforme">
                  {f.ConformePorNombre || f.ConformePor
                    ? `${f.ConformePorNombre || f.ConformePor} · ${fmtFechaHora(f.ConformeEn)}`
                    : '—'}
                </td>
                <td className="acciones">
                  <button className="btn btn-chico" onClick={() => onSeleccionar(f.Id)}>
                    {seleccionada?.Id === f.Id ? 'Cerrar' : 'Ver y firmar'}
                  </button>
                </td>
              </tr>
            ))}
            {!filtradas.length && (
              <tr>
                <td colSpan={9}>
                  <div className="estado"><p className="estado-tit">{vacioTxt}</p></div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cargandoDetalle && (
        <div className="estado">
          <div className="spinner" />
          <p>Cargando la verificación…</p>
        </div>
      )}

      {seleccionada && !cargandoDetalle && (
        <DetalleVerificacion
          verificacion={seleccionada}
          config={config}
          onFirmar={onFirmar}
          puedeFirmarSector={puedeFirmarSector(seleccionada.sector)}
          onPedirConforme={onPedirConforme}
        />
      )}
    </div>
  );
}

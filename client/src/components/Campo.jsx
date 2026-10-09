/**
 * Renderiza UN campo a partir de su definición en formConfig.js, con las clases
 * del estándar (.campo-grupo / .campo-etq / .campo / .campo-ayuda).
 * Lo usan la cabecera de la visita y cada fila de impresora, así que un tipo de
 * campo nuevo se agrega una sola vez acá.
 */
export default function Campo({ campo, valor, onChange, id, opcionesDinamicas = [] }) {
  const opciones = campo.optionsFrom ? opcionesDinamicas : campo.options || [];
  const ayudaId = campo.help ? `${id}-ayuda` : undefined;

  const comun = {
    id,
    className: 'campo',
    value: valor ?? '',
    onChange: (e) => onChange(e.target.value),
    'aria-describedby': ayudaId,
    required: campo.required || undefined,
  };

  return (
    <div className={`campo-grupo ${campo.type === 'textarea' ? 'ancho' : ''}`}>
      <label className="campo-etq" htmlFor={id}>
        {campo.label} {campo.required && <span className="req" aria-hidden="true">*</span>}
      </label>

      {campo.type === 'select' ? (
        <select {...comun}>
          <option value="">Seleccionar…</option>
          {opciones.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : campo.type === 'textarea' ? (
        <textarea {...comun} rows={2} maxLength={1000} />
      ) : (
        <input
          {...comun}
          type={campo.type === 'number' ? 'number' : campo.type === 'date' ? 'date' : 'text'}
          inputMode={campo.type === 'number' ? 'numeric' : undefined}
          min={campo.type === 'number' ? 0 : undefined}
          maxLength={campo.type === 'text' ? 255 : undefined}
        />
      )}

      {campo.help && <span className="campo-ayuda" id={ayudaId}>{campo.help}</span>}
    </div>
  );
}

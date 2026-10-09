import { useEffect, useId, useRef, useState } from 'react';

/**
 * Botón "?" con una explicación corta al lado del dato que explica.
 *
 *   <Ayuda titulo="Vigencia">
 *     Una tarifa no se edita: se le cierra la vigencia y se carga otra.
 *   </Ayuda>
 *
 * POR QUÉ NO ES SÓLO HOVER
 * En tablet y celular el hover no existe, y Pañol se usa con lápiz sobre tablet.
 * Un tooltip que sólo aparece al pasar el mouse es, en esos equipos, un botón que
 * no hace nada. Entonces:
 *   - clic o toque: abre y queda fijo hasta que se cierra (o se toca afuera);
 *   - hover: abre mientras el mouse esté encima, para no obligar a hacer clic;
 *   - teclado: es un <button>, así que entra con Tab y abre con Enter o Espacio;
 *   - Escape cierra.
 *
 * Tampoco usa el `title` del navegador: no se puede estilar, tarda un segundo en
 * aparecer, no sale nunca en pantallas táctiles y los lectores de pantalla lo
 * anuncian de forma despareja. Acá el panel se liga al botón con aria-describedby.
 */
export default function Ayuda({ titulo, children, etiqueta = 'Qué es esto' }) {
  const [fijo, setFijo] = useState(false);     // abierto por clic
  const [encima, setEncima] = useState(false); // abierto por hover
  const id = useId();
  const ref = useRef(null);
  const visible = fijo || encima;

  useEffect(() => {
    if (!fijo) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setFijo(false); };
    // Clic afuera: cierra. Sin esto quedan varios paneles abiertos a la vez.
    const onClic = (e) => { if (!ref.current?.contains(e.target)) setFijo(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClic);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClic);
    };
  }, [fijo]);

  return (
    <span
      className="ayuda"
      ref={ref}
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
    >
      <button
        type="button"
        className="ayuda-btn"
        aria-label={titulo ? `${etiqueta}: ${titulo}` : etiqueta}
        aria-expanded={visible}
        aria-describedby={visible ? id : undefined}
        onClick={() => setFijo((v) => !v)}
        onFocus={() => setEncima(true)}
        onBlur={() => setEncima(false)}
      >
        ?
      </button>
      {visible && (
        <span className="ayuda-panel" id={id} role="tooltip">
          {titulo && <strong className="ayuda-tit">{titulo}</strong>}
          {children}
        </span>
      )}
    </span>
  );
}

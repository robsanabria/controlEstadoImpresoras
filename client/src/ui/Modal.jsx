import { useEffect, useRef } from 'react';

// Copiado desde plataforma/ui/react — NO EDITAR acá: cambiar en plataforma y propagar.

/**
 * Modal de confirmación. Centrado en escritorio, hoja desde abajo en celular
 * (lo resuelve patrones.css). Se usa sólo para decisiones que no se pueden
 * deshacer; lo demás va en línea o con toast.
 *
 * @param {boolean}   abierto
 * @param {string}    titulo
 * @param {function}  [onCerrar]  se llama con Escape o clic afuera. Si no viene, el modal
 *                                sólo se cierra desde sus acciones (p. ej. mientras guarda).
 * @param {ReactNode} acciones    botones (.btn); el primario va ÚLTIMO, así queda a la derecha
 *                                en escritorio y más cerca del pulgar en celular
 * @param {ReactNode} children    cuerpo
 */
export default function Modal({ abierto, titulo, onCerrar, acciones, children }) {
  const cajaRef = useRef(null);
  // onCerrar suele ser una arrow nueva en cada render del padre: se guarda en
  // un ref para que el efecto no se rearme (y no vuelva a mover el foco) cada vez.
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;

  useEffect(() => {
    if (!abierto) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCerrarRef.current?.(); };
    window.addEventListener('keydown', onKey);
    // Foco al primer control para que Tab y Enter funcionen sin tocar la
    // pantalla. Si el que usa el modal quiere otro foco inicial, lo pone en su
    // propio efecto: corre después de este.
    cajaRef.current?.querySelector('button, a, input')?.focus();
    const scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = scrollPrevio;
    };
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div className="modal-fondo" onClick={(e) => { if (e.target === e.currentTarget) onCerrarRef.current?.(); }}>
      <div className="modal-caja" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" ref={cajaRef}>
        <h2 className="modal-tit" id="modal-titulo">{titulo}</h2>
        <div className="modal-cuerpo">{children}</div>
        {acciones && <div className="modal-acciones">{acciones}</div>}
      </div>
    </div>
  );
}

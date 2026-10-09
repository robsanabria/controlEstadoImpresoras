import { useEffect, useState } from 'react';

// Copiado desde plataforma/ui/react — NO EDITAR acá: cambiar en plataforma y propagar.
//
// Uso:
//   import Toasts, { avisar } from './ui/Toasts';
//   <Toasts />                       una sola vez, en App.jsx
//   avisar('Control guardado', 'ok') desde cualquier lado; tipos: ok | mal | aviso | (nada = info)
//
// No hay contexto ni provider: un evento en window alcanza y no obliga a
// envolver la app. El toast se va solo a los 4 s (8 s si es de error).

const EVENTO = 'offal-ui:toast';
let secuencia = 0;

export function avisar(mensaje, tipo) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { id: ++secuencia, mensaje, tipo } }));
}

export default function Toasts() {
  const [lista, setLista] = useState([]);

  useEffect(() => {
    const onToast = (e) => {
      const t = e.detail;
      setLista((l) => [...l, t]);
      setTimeout(() => setLista((l) => l.filter((x) => x.id !== t.id)), t.tipo === 'mal' ? 8000 : 4000);
    };
    window.addEventListener(EVENTO, onToast);
    return () => window.removeEventListener(EVENTO, onToast);
  }, []);

  if (lista.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {lista.map((t) => (
        <div key={t.id} className={`toast${t.tipo ? ` toast-${t.tipo}` : ''}`}>
          {t.mensaje}
          <button className="cerrar" aria-label="Cerrar" onClick={() => setLista((l) => l.filter((x) => x.id !== t.id))}>×</button>
        </div>
      ))}
    </div>
  );
}

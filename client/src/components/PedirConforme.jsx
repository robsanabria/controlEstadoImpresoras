import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Modal from '../ui/Modal';
import { getVerificacion } from '../api';
import { urlDeFirma } from '../lib/ruta';
import { fmtFechaHora } from './DetalleVerificacion';

// Cada cuánto se le pregunta al servidor si el encargado ya firmó, y hasta
// cuándo. Si se pasa el límite se deja de preguntar y queda el link a mano: la
// verificación sigue pendiente y se puede firmar más tarde.
const ESPERA_MS = 4000;
const LIMITE_MS = 10 * 60 * 1000;

/**
 * Modal que le pide el conforme al encargado: muestra el QR del link de firma
 * para que lo escanee con SU celular, y se queda esperando hasta que firme.
 *
 * No hay ningún atajo para firmar desde acá: el firmante tiene que ser el
 * encargado en su propia sesión (ver lib/ruta.js).
 */
export default function PedirConforme({ verificacion, onCerrar, onFirmada }) {
  const [qr, setQr] = useState(null);
  const [estado, setEstado] = useState(verificacion.Estado);
  const [firmada, setFirmada] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [seCansoDeEsperar, setSeCansoDeEsperar] = useState(false);

  const url = urlDeFirma(verificacion.Id);
  // onFirmada suele ser una arrow nueva en cada render del padre: va a un ref
  // para que el efecto del polling no se rearme en cada vuelta.
  const onFirmadaRef = useRef(onFirmada);
  onFirmadaRef.current = onFirmada;

  // El QR tiene que ser negro sobre blanco literal para que la cámara lo lea,
  // así que acá sí van colores a mano: es la única excepción del módulo.
  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((dataUrl) => { if (vivo) setQr(dataUrl); })
      .catch(() => { if (vivo) setQr(false); });
    return () => { vivo = false; };
  }, [url]);

  // Espera la firma. Se corta sola cuando la verificación deja de estar
  // pendiente, cuando se cierra el modal o cuando se agota el límite.
  useEffect(() => {
    if (estado !== 'Pendiente') return undefined;

    let vivo = true;
    const desde = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - desde > LIMITE_MS) {
        if (vivo) setSeCansoDeEsperar(true);
        clearInterval(timer);
        return;
      }
      try {
        const v = await getVerificacion(verificacion.Id);
        if (!vivo || v.Estado === 'Pendiente') return;
        setEstado(v.Estado);
        setFirmada(v);
        onFirmadaRef.current?.(v);
      } catch {
        // Un error puntual de red no corta la espera: se reintenta solo.
      }
    }, ESPERA_MS);

    return () => { vivo = false; clearInterval(timer); };
  }, [estado, verificacion.Id]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  const resuelta = estado !== 'Pendiente';

  return (
    <Modal
      abierto
      titulo={resuelta ? `Verificación #${verificacion.Id} resuelta` : 'Pedile el conforme al encargado'}
      onCerrar={onCerrar}
      acciones={
        <button className="btn btn-primario" onClick={onCerrar}>
          {resuelta ? 'Listo' : 'Cerrar'}
        </button>
      }
    >
      <p className="panel-sub">
        Verificación <strong>#{verificacion.Id}</strong> · {verificacion.sector} · turno{' '}
        {verificacion.turno}
      </p>

      {resuelta ? (
        <div className={`alerta ${estado === 'Conforme' ? 'alerta-ok' : 'alerta-aviso'}`} role="status">
          <div>
            <strong>
              {estado === 'Conforme' ? 'Conforme firmado por ' : 'Observada por '}
              {firmada?.ConformePorNombre || firmada?.ConformePor}
            </strong>
            {firmada?.ConformeEn && <span className="panel-sub"> · {fmtFechaHora(firmada.ConformeEn)}</span>}
            {firmada?.ConformeComentario && <div className="cita">“{firmada.ConformeComentario}”</div>}
          </div>
        </div>
      ) : (
        <>
          <p>
            Que el encargado de {verificacion.sector} escanee este código con <strong>su</strong> celular.
            Entra con su usuario y firma desde ahí: la firma vale porque la da él, no el celular que tenés
            en la mano.
          </p>

          <div className="qr-caja">
            {qr === null && <div className="spinner" />}
            {qr === false && <p className="panel-sub">No pudimos generar el código. Usá el link de abajo.</p>}
            {qr && <img className="qr-img" src={qr} alt={`Código QR para firmar la verificación ${verificacion.Id}`} width={320} height={320} />}
          </div>

          <div className="qr-link">
            <code>{url}</code>
            <button className="btn btn-chico" onClick={copiar}>
              {copiado ? 'Copiado' : 'Copiar link'}
            </button>
          </div>

          <p className="panel-sub" aria-live="polite">
            {seCansoDeEsperar ? (
              <>
                Dejamos de esperar. La verificación queda <strong>pendiente</strong>: el encargado puede
                firmarla más tarde con este mismo link, o desde “Pendientes de conforme”.
              </>
            ) : (
              <>
                <span className="spinner spinner-chico" /> Esperando la firma…
              </>
            )}
          </p>
        </>
      )}
    </Modal>
  );
}

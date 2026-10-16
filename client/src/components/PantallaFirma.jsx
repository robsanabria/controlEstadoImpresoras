import { useCallback, useEffect, useState } from 'react';
import { getVerificacion } from '../api';
import DetalleVerificacion from './DetalleVerificacion';

/**
 * Pantalla a la que cae el encargado cuando escanea el QR (/firmar/<id>).
 *
 * Es una sola cosa y nada más: la verificación que tiene que firmar, sin
 * pestañas ni listados, porque llega de la cámara del celular y lo único que
 * tiene que hacer es leer y decidir. El bloque de conforme es el mismo de
 * DetalleVerificacion, así que las reglas (rol, sector, no firma quien cargó)
 * son exactamente las mismas, y el servidor las revalida igual.
 */
export default function PantallaFirma({ id, config, onFirmar, onSalir }) {
  const [verificacion, setVerificacion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setVerificacion(await getVerificacion(id));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function firmar(...args) {
    await onFirmar(...args);
    // Vuelve a leerla para mostrar la firma ya registrada (quién y cuándo).
    await cargar();
  }

  if (cargando) {
    return (
      <div className="estado">
        <div className="spinner" />
        <p>Buscando la verificación #{id}…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="estado es-error">
        <p className="estado-tit">No pudimos abrir la verificación #{id}</p>
        <p>{error}</p>
        <button className="btn" onClick={onSalir}>Ir al módulo</button>
      </div>
    );
  }

  return (
    <>
      <div className="head">
        <p className="overline">Conforme del encargado</p>
        <h1>Verificación #{verificacion.Id}</h1>
        <p className="lead">
          {verificacion.Estado === 'Pendiente'
            ? `Revisá los chequeos que cargó Sistemas y dale el conforme, o observala si algo no está bien.`
            : 'Esta verificación ya fue resuelta.'}
        </p>
      </div>

      {/* GET /api/verificaciones/:id ya trae `puedeFirmar` calculado en el
          servidor, así que el fallback de abajo no se usa; va en false para que
          si algún día falta, el botón no aparezca de prestado. */}
      <DetalleVerificacion
        verificacion={verificacion}
        config={config}
        onFirmar={firmar}
        puedeFirmarSector={false}
      />

      <div className="form-acciones">
        <button className="btn" onClick={onSalir}>Ir al módulo completo</button>
      </div>
    </>
  );
}

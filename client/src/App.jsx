import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getMe, getFormConfig, getVerificaciones, getVerificacion, crearVerificacion, firmarVerificacion, getExport,
} from './api';
import Navbar from './ui/Navbar';
import Toasts, { avisar } from './ui/Toasts';
import VerificacionForm from './components/VerificacionForm';
import PanelVerificaciones from './components/PanelVerificaciones';

/** CSV plano: una fila por chequeo, con la numeración original del formulario. */
function aCSV(config, filas) {
  const cv = config.campos_visita;
  const cols = [
    'Verificación', ...cv.map((c) => c.label),
    'Sección', 'Nº pregunta', 'Pregunta', 'Respuesta', 'Problemática', '¿Problema?',
    'Estado', 'Cargada por', 'Cargada el', 'Conforme de', 'Conforme el', 'Comentario del conforme',
  ];
  const keys = [
    'Id', ...cv.map((c) => c.name),
    'Seccion', 'PreguntaNro', 'Pregunta', 'Respuesta', 'Problematica', 'EsFalla',
    'Estado', 'CreadoPorNombre', 'CreadoEn', 'ConformePorNombre', 'ConformeEn', 'ConformeComentario',
  ];
  const esc = (x) => {
    const v = typeof x === 'boolean' ? (x ? 'Sí' : 'No') : x;
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
  };
  return [cols.map(esc).join(','), ...filas.map((f) => keys.map((k) => esc(f[k])).join(','))].join('\r\n');
}

function descargar(csv, nombre) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [config, setConfig] = useState(null);
  const [vista, setVista] = useState('cargar'); // 'cargar' | 'conforme' | 'historial'
  const [pendientes, setPendientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

  const permisos = usuario?.permisos || { cargar: false, firmarSectores: [] };

  const puedeFirmarSector = useCallback(
    (sector) => {
      const a = permisos.firmarSectores;
      return a === '*' || (Array.isArray(a) && a.includes(sector));
    },
    [permisos.firmarSectores]
  );

  useEffect(() => {
    (async () => {
      try {
        const [me, cfg] = await Promise.all([getMe(), getFormConfig()]);
        setUsuario(me);
        setConfig(cfg);
        if (!me.permisos?.cargar) setVista('conforme');
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const recargarListas = useCallback(async () => {
    const [p, h] = await Promise.all([getVerificaciones('Pendiente'), getVerificaciones()]);
    setPendientes(p);
    setHistorial(h);
  }, []);

  const refrescar = useCallback(async () => {
    try {
      setRefrescando(true);
      await recargarListas();
    } catch (err) {
      avisar(err.message, 'mal');
    } finally {
      setRefrescando(false);
    }
  }, [recargarListas]);

  // Carga las listas al entrar por primera vez a una vista de listado.
  useEffect(() => {
    if (!config || vista === 'cargar') return;
    refrescar();
  }, [vista, config, refrescar]);

  async function abrir(id) {
    if (seleccionada?.Id === id) { setSeleccionada(null); return; }
    try {
      setCargandoDetalle(true);
      setSeleccionada(await getVerificacion(id));
    } catch (err) {
      avisar(err.message, 'mal');
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function onCrear(payload) {
    const creada = await crearVerificacion(payload);
    avisar(
      `Verificación #${creada.Id} guardada. Pendiente del conforme del encargado de ${creada.sector}.`,
      'ok'
    );
    recargarListas().catch(() => {});
    return creada;
  }

  async function onFirmar(id, decision, comentario) {
    try {
      const actualizada = await firmarVerificacion(id, decision, comentario);
      setSeleccionada({ ...actualizada, puedeFirmar: false });
      avisar(
        decision === 'conforme'
          ? `Conforme registrado en la verificación #${id}.`
          : `Verificación #${id} marcada como observada.`,
        decision === 'conforme' ? 'ok' : 'aviso'
      );
      await recargarListas();
    } catch (err) {
      // Si otro la resolvió primero, refrescamos para mostrar el estado real.
      if (err.code === 'CONFLICTO') {
        await recargarListas().catch(() => {});
        try { setSeleccionada(await getVerificacion(id)); } catch { /* el detalle queda como estaba */ }
      }
      throw err;
    }
  }

  async function exportar() {
    try {
      descargar(aCSV(config, await getExport()), 'verificacion-lectores.csv');
    } catch (err) {
      avisar(err.message, 'mal');
    }
  }

  const tabs = useMemo(() => {
    const t = [];
    if (permisos.cargar) t.push({ id: 'cargar', txt: 'Nueva verificación' });
    t.push({
      id: 'conforme',
      txt: `Pendientes de conforme${pendientes.length ? ` (${pendientes.length})` : ''}`,
    });
    t.push({ id: 'historial', txt: 'Historial' });
    return t;
  }, [permisos.cargar, pendientes.length]);

  if (cargando) {
    return (
      <div className="estado">
        <div className="spinner" />
        <p>Cargando…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="estado es-error">
        <p className="estado-tit">No pudimos abrir el módulo</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <a className="skip" href="#contenido">Ir al contenido</a>
      <Navbar
        usuario={usuario}
        marca="Lectores"
        env={usuario?.env}
        modulos={usuario?.modulos}
        claveActual="lectores"
      />
      <main className="wrap" id="contenido">
        <div className="head">
          <p className="overline">Sistemas · Planta</p>
          <h1>{config?.meta?.titulo}</h1>
          {config?.meta?.descripcion && <p className="lead">{config.meta.descripcion}</p>}
        </div>

        <nav className="tabs" aria-label="Pantallas del módulo">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`tab ${vista === t.id ? 'on' : ''}`}
              aria-current={vista === t.id ? 'page' : undefined}
              onClick={() => { setVista(t.id); setSeleccionada(null); }}
            >
              {t.txt}
            </button>
          ))}
        </nav>

        {vista === 'cargar' && <VerificacionForm config={config} onSubmit={onCrear} />}

        {vista === 'conforme' && (
          <PanelVerificaciones
            config={config}
            filas={pendientes}
            seleccionada={seleccionada}
            cargandoDetalle={cargandoDetalle}
            onSeleccionar={abrir}
            onFirmar={onFirmar}
            onRefrescar={refrescar}
            refrescando={refrescando}
            vacioTxt="No hay verificaciones esperando conforme."
            puedeFirmarSector={puedeFirmarSector}
          />
        )}

        {vista === 'historial' && (
          <PanelVerificaciones
            config={config}
            filas={historial}
            seleccionada={seleccionada}
            cargandoDetalle={cargandoDetalle}
            onSeleccionar={abrir}
            onFirmar={onFirmar}
            onRefrescar={refrescar}
            refrescando={refrescando}
            onExportar={exportar}
            conBusqueda
            vacioTxt="Todavía no hay verificaciones cargadas."
            puedeFirmarSector={puedeFirmarSector}
          />
        )}

        <footer className="pie"><span>Offal · Verificación de Lectores</span></footer>
      </main>
      <Toasts />
    </>
  );
}

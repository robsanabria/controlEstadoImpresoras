-- ===========================================================================
--  Cierre administrativo de las verificaciones pendientes — 2026-10-27
--
--  Pegar en el editor de consultas del portal de Azure, base controletiquetas.
--  Un solo lote, sin GO. NO tiene secretos: este archivo se commitea.
--
--  POR QUÉ: el módulo salió a producción antes de que los encargados estuvieran
--  en el padrón, así que las verificaciones que Sistemas fue cargando quedaron
--  todas en Pendiente sin que nadie pudiera firmarlas. Esto limpia esa cola de
--  arrastre para arrancar de cero con el circuito ya habilitado.
--
--  QUÉ NO HACE: no pone la firma de Vega ni de Maciel. Ellos no firmaron estas
--  verificaciones, y el conforme es justamente el dato que dice que un encargado
--  las revisó. Se cierran a nombre de Sistemas y con el motivo escrito en el
--  comentario, así en el historial se distingue de un conforme real.
--
--  DE ACÁ EN ADELANTE: las nuevas las firman los encargados desde el QR. Este
--  script es de una sola vez; no se vuelve a correr.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Antes: qué se va a cerrar.
-- ---------------------------------------------------------------------------
SELECT Id, fecha, sector, turno, Estado, CreadoPor
  FROM sistemas.VerificacionLectores
 WHERE Estado = N'Pendiente'
 ORDER BY Id;

-- ---------------------------------------------------------------------------
-- 2) Cerrarlas. Sólo las Pendiente: no toca ninguna ya firmada ni observada.
-- ---------------------------------------------------------------------------
UPDATE sistemas.VerificacionLectores
   SET Estado             = N'Conforme',
       ConformePor        = N'roberto.sanabria@offal.com.ar',
       ConformePorNombre  = N'Roberto Sanabria',
       ConformeEn         = SYSUTCDATETIME(),
       ConformeComentario = N'Cierre administrativo de Sistemas (27/10/2026). '
                          + N'Verificación cargada antes de que los encargados '
                          + N'estuvieran habilitados para firmar: NO tiene conforme '
                          + N'del encargado del sector.'
 WHERE Estado = N'Pendiente';

-- ---------------------------------------------------------------------------
-- 3) Control: no tiene que quedar ninguna Pendiente.
-- ---------------------------------------------------------------------------
SELECT Estado, COUNT(*) AS cantidad
  FROM sistemas.VerificacionLectores
 GROUP BY Estado
 ORDER BY Estado;

#!/usr/bin/env node
/**
 * Genera el DDL idempotente de las dos tablas a partir de config/formConfig.js.
 *
 * La app NO crea nada al arrancar (regla del estándar Offal): el DDL se guarda
 * como archivo en db/migrations y lo corre Sistemas contra la base.
 *
 *   npm run migracion                                   # lo imprime
 *   npm run migracion > db/migrations/002-descripcion.sql
 *
 * Ojo: sólo la CABECERA tiene una columna por campo (sale de CAMPOS_VISITA). Las
 * respuestas van en filas del detalle (pregunta + respuesta + problemática), así
 * que agregar, sacar o reescribir una pregunta en CHECKS NO necesita migración.
 */
const { CAMPOS_VISITA, FORM_META, ESTADOS } = require('../config/formConfig');

function ddlTipo(sqlType) {
  if (sqlType === 'date') return 'DATE';
  if (sqlType === 'int') return 'INT';
  if (sqlType === 'texto') return 'NVARCHAR(1000)';
  return 'NVARCHAR(255)';
}

const { esquema, tabla, tablaNombre, tablaDetalle, tablaDetalleNombre } = FORM_META;

const colsVisita = CAMPOS_VISITA
  .map((c) => `    [${c.name}] ${ddlTipo(c.sqlType)} ${c.required ? 'NOT NULL' : 'NULL'},`)
  .join('\n');

process.stdout.write(`-- ============================================================================
-- ${FORM_META.titulo}
-- Generado por scripts/generar-migracion.js desde config/formConfig.js.
-- Idempotente: se puede correr de nuevo sin romper nada.
-- Base: controletiquetas (compartida). Esquema propio: ${esquema}.
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = '${esquema}')
    EXEC('CREATE SCHEMA ${esquema}');
GO

-- Cabecera: una fila por verificación.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = '${esquema}' AND t.name = '${tablaNombre}'
)
CREATE TABLE ${tabla} (
    [Id] INT IDENTITY(1,1) CONSTRAINT PK_${tablaNombre} PRIMARY KEY,
${colsVisita}
    -- Circuito de conforme: ${Object.values(ESTADOS).join(' / ')}
    [Estado] NVARCHAR(20) NOT NULL
        CONSTRAINT DF_${tablaNombre}_Estado DEFAULT '${ESTADOS.PENDIENTE}'
        CONSTRAINT CK_${tablaNombre}_Estado CHECK ([Estado] IN (${Object.values(ESTADOS).map((e) => `'${e}'`).join(', ')})),
    -- Quién cargó la verificación (identidad de Easy Auth, no escrita a mano).
    [CreadoPor] NVARCHAR(255) NULL,
    [CreadoPorNombre] NVARCHAR(255) NULL,
    [CreadoEn] DATETIME2 NOT NULL CONSTRAINT DF_${tablaNombre}_CreadoEn DEFAULT SYSUTCDATETIME(),
    -- Firma del encargado del sector.
    [ConformePor] NVARCHAR(255) NULL,
    [ConformePorNombre] NVARCHAR(255) NULL,
    [ConformeEn] DATETIME2 NULL,
    [ConformeComentario] NVARCHAR(1000) NULL
);
GO

-- Detalle: una fila por chequeo. Guarda la pregunta TAL COMO SE HIZO (texto y
-- número del Form), así cambiar el cuestionario no reescribe lo ya firmado.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = '${esquema}' AND t.name = '${tablaDetalleNombre}'
)
CREATE TABLE ${tablaDetalle} (
    [Id] INT IDENTITY(1,1) CONSTRAINT PK_${tablaDetalleNombre} PRIMARY KEY,
    [VerificacionId] INT NOT NULL,
    [Orden] INT NOT NULL,
    [Seccion] NVARCHAR(100) NOT NULL,
    [PreguntaId] NVARCHAR(100) NOT NULL,
    [PreguntaNro] INT NULL,
    [Pregunta] NVARCHAR(500) NOT NULL,
    [Respuesta] NVARCHAR(20) NOT NULL,
    [Problematica] NVARCHAR(1000) NULL,
    -- 1 cuando la respuesta no es la esperada: es lo que se cuenta como falla.
    [EsFalla] BIT NOT NULL CONSTRAINT DF_${tablaDetalleNombre}_EsFalla DEFAULT 0,
    CONSTRAINT FK_${tablaDetalleNombre}_Verificacion FOREIGN KEY ([VerificacionId])
        REFERENCES ${tabla} ([Id]) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_${tablaDetalleNombre}_VerificacionId')
    CREATE INDEX IX_${tablaDetalleNombre}_VerificacionId ON ${tablaDetalle} ([VerificacionId]);
GO

-- Bandeja de pendientes de conforme: es la consulta más frecuente.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_${tablaNombre}_Estado')
    CREATE INDEX IX_${tablaNombre}_Estado ON ${tabla} ([Estado]) INCLUDE ([fecha], [sector]);
GO
`);

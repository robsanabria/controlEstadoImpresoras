-- ============================================================================
-- Verificación de Lectores
-- Generado por scripts/generar-migracion.js desde config/formConfig.js.
-- Idempotente: se puede correr de nuevo sin romper nada.
-- Base: controletiquetas (compartida). Esquema propio: sistemas.
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'sistemas')
    EXEC('CREATE SCHEMA sistemas');
GO

-- Cabecera: una fila por verificación.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'sistemas' AND t.name = 'VerificacionLectores'
)
CREATE TABLE sistemas.VerificacionLectores (
    [Id] INT IDENTITY(1,1) CONSTRAINT PK_VerificacionLectores PRIMARY KEY,
    [fecha] DATE NOT NULL,
    [sector] NVARCHAR(255) NOT NULL,
    [turno] NVARCHAR(255) NULL,
    [observaciones_generales] NVARCHAR(1000) NULL,
    -- Circuito de conforme: Pendiente / Conforme / Observado
    [Estado] NVARCHAR(20) NOT NULL
        CONSTRAINT DF_VerificacionLectores_Estado DEFAULT 'Pendiente'
        CONSTRAINT CK_VerificacionLectores_Estado CHECK ([Estado] IN ('Pendiente', 'Conforme', 'Observado')),
    -- Quién cargó la verificación (identidad de Easy Auth, no escrita a mano).
    [CreadoPor] NVARCHAR(255) NULL,
    [CreadoPorNombre] NVARCHAR(255) NULL,
    [CreadoEn] DATETIME2 NOT NULL CONSTRAINT DF_VerificacionLectores_CreadoEn DEFAULT SYSUTCDATETIME(),
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
    WHERE s.name = 'sistemas' AND t.name = 'VerificacionLectoresDetalle'
)
CREATE TABLE sistemas.VerificacionLectoresDetalle (
    [Id] INT IDENTITY(1,1) CONSTRAINT PK_VerificacionLectoresDetalle PRIMARY KEY,
    [VerificacionId] INT NOT NULL,
    [Orden] INT NOT NULL,
    [Seccion] NVARCHAR(100) NOT NULL,
    [PreguntaId] NVARCHAR(100) NOT NULL,
    [PreguntaNro] INT NULL,
    [Pregunta] NVARCHAR(500) NOT NULL,
    [Respuesta] NVARCHAR(20) NOT NULL,
    [Problematica] NVARCHAR(1000) NULL,
    -- 1 cuando la respuesta no es la esperada: es lo que se cuenta como falla.
    [EsFalla] BIT NOT NULL CONSTRAINT DF_VerificacionLectoresDetalle_EsFalla DEFAULT 0,
    CONSTRAINT FK_VerificacionLectoresDetalle_Verificacion FOREIGN KEY ([VerificacionId])
        REFERENCES sistemas.VerificacionLectores ([Id]) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VerificacionLectoresDetalle_VerificacionId')
    CREATE INDEX IX_VerificacionLectoresDetalle_VerificacionId ON sistemas.VerificacionLectoresDetalle ([VerificacionId]);
GO

-- Bandeja de pendientes de conforme: es la consulta más frecuente.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VerificacionLectores_Estado')
    CREATE INDEX IX_VerificacionLectores_Estado ON sistemas.VerificacionLectores ([Estado]) INCLUDE ([fecha], [sector]);
GO

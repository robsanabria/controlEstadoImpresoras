-- ============================================================================
-- Verificación de Lectores — columnas de la cabecera
-- Generado por: npm run migracion -- --columnas
-- Idempotente: agrega sólo lo que falte, se puede correr de nuevo.
-- Base: controletiquetas (compartida). Esquema: sistemas.
-- ============================================================================

IF COL_LENGTH('sistemas.VerificacionLectores', 'fecha') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [fecha] DATE NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'sector') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [sector] NVARCHAR(255) NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'turno') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [turno] NVARCHAR(255) NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'observaciones_generales') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [observaciones_generales] NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'armadora_sorteada') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [armadora_sorteada] INT NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'armadora') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [armadora] INT NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'armadora_motivo') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [armadora_motivo] NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'tronera_sorteada') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [tronera_sorteada] INT NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'tronera') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [tronera] INT NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'tronera_motivo') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [tronera_motivo] NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'linea_empaque_sorteada') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [linea_empaque_sorteada] INT NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'linea_empaque') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [linea_empaque] INT NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'linea_empaque_motivo') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [linea_empaque_motivo] NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'balanza_sorteada') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [balanza_sorteada] INT NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'balanza') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [balanza] INT NULL;
GO
IF COL_LENGTH('sistemas.VerificacionLectores', 'balanza_motivo') IS NULL
    ALTER TABLE sistemas.VerificacionLectores ADD [balanza_motivo] NVARCHAR(1000) NULL;
GO

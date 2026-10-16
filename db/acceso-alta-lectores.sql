-- ===========================================================================
--  Alta de la app 'lectores' en el padrón central (acceso)
--
--  Pegar en el editor de consultas del portal de Azure, base controletiquetas.
--  Sin GO, un solo lote, idempotente: se puede correr de nuevo.
--  NO tiene secretos: este archivo se commitea.
--
--  Después de correrlo hay que poner la App Setting
--  LECTORES_REQUIRE_PERMISSION=true en el App Service verificacionlectores.
--  Hasta entonces el rol no se exige y cualquier usuario autenticado puede
--  cargar y firmar.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Catálogo: la tarjeta que la barra "Mis módulos" muestra.
--    Libre = 0  → sólo la ven los que tienen permiso (no es de acceso libre).
--    Activa = 1 → aparece para quien tenga permiso.
-- ---------------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM acceso.Apps WHERE App = N'lectores')
    UPDATE acceso.Apps
       SET Nombre = N'Verificación de Lectores',
           Url = N'https://verificacion.offalexpsa.ar',
           Orden = 95, Libre = 0, Activa = 1, Actualizado = SYSUTCDATETIME()
     WHERE App = N'lectores';
ELSE
    INSERT INTO acceso.Apps (App, Nombre, Url, Orden, Libre, Activa, Actualizado)
    VALUES (N'lectores', N'Verificación de Lectores',
            N'https://verificacion.offalexpsa.ar', 95, 0, 1, SYSUTCDATETIME());

-- ---------------------------------------------------------------------------
-- 2) Quiénes CARGAN las verificaciones (rol SISTEMAS).
--    COMPLETAR con los mails de Sistemas. El padrón no tiene columna de
--    sector, así que no hay forma de sacarlos con una consulta.
--    Un mail que no exista en acceso.Usuarios se informa al final y se ignora.
-- ---------------------------------------------------------------------------
-- El equipo de Sistemas al 2026-10-16. Los diez están en el padrón y activos
-- (verificado contra acceso.Usuarios).
DECLARE @carga TABLE (Email NVARCHAR(255) PRIMARY KEY);
INSERT INTO @carga (Email) VALUES
    (N'gustavo.cardozo@offal.com.ar'),    -- #14
    (N'tobias.santillan@offal.com.ar'),   -- #53
    (N'roberto.sanabria@offal.com.ar'),   -- #1
    (N'andrea.cardozo@offal.com.ar'),     -- #12
    (N'matias.juarez@offal.com.ar'),      -- #10
    (N'juan.penalba@offal.com.ar'),       -- #9
    (N'nicolas.gutierrez@offal.com.ar'),  -- #8
    (N'norberto.haunau@offal.com.ar'),    -- #6
    (N'luis.arancibia@offal.com.ar'),     -- #13
    (N'miguel.flores@offal.com.ar')       -- #18 (Miguel, no Gonzalo Flores #54)
;

-- ---------------------------------------------------------------------------
-- 2.5) Alta en el padrón de los encargados que firman.
--      Martín Maciel y Sergio Vega tienen cuenta en Entra (verificado), pero NO
--      estaban en acceso.Usuarios, y sin eso el módulo les da 403 ("no figura
--      en el padrón") apenas entran por el QR.
--      El módulo busca por Email, así que alcanza con mail, nombre y Activo:
--      EntraObjectId y PasswordHash van NULL, igual que las altas recientes.
-- ---------------------------------------------------------------------------
MERGE acceso.Usuarios AS d
USING (VALUES
    (N'martin.maciel@offal.com.ar', N'Martin Maciel'),
    (N'sergio.vega@offal.com.ar',   N'Sergio Vega')
) AS o (Email, Nombre) ON d.Email = o.Email
WHEN NOT MATCHED THEN
    INSERT (Email, Nombre, Activo, FechaAlta)
    VALUES (o.Email, o.Nombre, 1, SYSUTCDATETIME())
WHEN MATCHED AND d.Activo = 0 THEN
    UPDATE SET d.Activo = 1, d.FechaModif = SYSUTCDATETIME();

-- ---------------------------------------------------------------------------
-- 3) Quiénes FIRMAN el conforme.
--    Roles posibles (ver config/roles.js):
--      ENCARGADO            → firma los dos sectores
--      ENCARGADO INSUMOS    → firma sólo Insumos
--      ENCARGADO EMPAQUE    → firma sólo Empaque
--      ADMIN                → carga y firma todo
--    OJO: con PERMITIR_AUTOFIRMA=false (lo que está hoy en producción) nadie
--    firma lo que cargó él mismo. Si la misma persona está en @carga y es la
--    única que firma, las verificaciones quedan Pendiente para siempre.
-- ---------------------------------------------------------------------------
--    El rol define QUÉ SECTOR firma cada uno (ver ROLES_FIRMA en
--    config/roles.js). Si el par queda cambiado, los dos reciben "no podés
--    firmar verificaciones de ese sector" y el circuito se traba en la firma.
DECLARE @firma TABLE (Email NVARCHAR(255), Rol VARCHAR(50), PRIMARY KEY (Email, Rol));
INSERT INTO @firma (Email, Rol) VALUES
    (N'sergio.vega@offal.com.ar',   'ENCARGADO INSUMOS'),
    (N'martin.maciel@offal.com.ar', 'ENCARGADO EMPAQUE')
;

-- ---------------------------------------------------------------------------
-- 4) Aplicar. Un usuario queda con un solo rol por app, así que si ya tenía
--    otro se actualiza en vez de duplicar.
-- ---------------------------------------------------------------------------
DECLARE @nuevos TABLE (UsuarioId INT, Rol VARCHAR(50), PRIMARY KEY (UsuarioId));

INSERT INTO @nuevos (UsuarioId, Rol)
SELECT u.UsuarioId, x.Rol
  FROM (
        SELECT Email, CAST('SISTEMAS' AS VARCHAR(50)) AS Rol, 1 AS prioridad FROM @carga
        UNION ALL
        SELECT Email, Rol, 0 AS prioridad FROM @firma
       ) x
  JOIN acceso.Usuarios u ON u.Email = x.Email
 WHERE u.Activo = 1
   -- Si alguien figura en las dos listas, gana el rol de firma (prioridad 0),
   -- que es el más amplio.
   AND x.prioridad = (SELECT MIN(y.prioridad)
                        FROM (SELECT Email, 1 AS prioridad FROM @carga
                              UNION ALL
                              SELECT Email, 0 AS prioridad FROM @firma) y
                       WHERE y.Email = x.Email);

UPDATE p
   SET p.Rol = n.Rol
  FROM acceso.Permisos p
  JOIN @nuevos n ON n.UsuarioId = p.UsuarioId
 WHERE p.App = N'lectores' AND p.Rol <> n.Rol;

INSERT INTO acceso.Permisos (UsuarioId, App, Rol)
SELECT n.UsuarioId, N'lectores', n.Rol
  FROM @nuevos n
 WHERE NOT EXISTS (SELECT 1 FROM acceso.Permisos p
                    WHERE p.UsuarioId = n.UsuarioId AND p.App = N'lectores');

-- ---------------------------------------------------------------------------
-- 5) Control.
-- ---------------------------------------------------------------------------
SELECT N'mail que no está en el padrón (o inactivo)' AS aviso, t.Email
  FROM (SELECT Email FROM @carga UNION SELECT Email FROM @firma) t
 WHERE NOT EXISTS (SELECT 1 FROM acceso.Usuarios u
                    WHERE u.Email = t.Email AND u.Activo = 1);

SELECT u.Nombre, u.Email, p.Rol,
       CASE WHEN p.Rol IN ('ADMIN', 'SISTEMAS') THEN 'sí' ELSE 'no' END AS puede_cargar,
       CASE p.Rol WHEN 'ADMIN' THEN 'los dos sectores'
                  WHEN 'ENCARGADO' THEN 'los dos sectores'
                  WHEN 'ENCARGADO INSUMOS' THEN 'sólo Insumos'
                  WHEN 'ENCARGADO EMPAQUE' THEN 'sólo Empaque'
                  ELSE 'no firma' END AS puede_firmar
  FROM acceso.Permisos p
  JOIN acceso.Usuarios u ON u.UsuarioId = p.UsuarioId
 WHERE p.App = N'lectores'
 ORDER BY p.Rol, u.Nombre;

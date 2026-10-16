# Verificación de Lectores — Offal

Módulo del ecosistema Offal que **reemplaza el Microsoft Form "VERIFICACIÓN DE
LECTORES"**. Tiene dos manos:

1. **Sistemas hace la prueba y carga la verificación**: responde los 10 chequeos
   de las 6 estaciones (armado de cajas, troneras, empaque, rechazo, balanza,
   rechazo despostada).
2. **El encargado del turno da el conforme**: entra con su usuario, ve la
   verificación completa y firma (o la observa con un comentario). Por eso el
   **turno es obligatorio**: sin turno no se sabe a quién le toca firmar.

Login único con **Entra ID (Easy Auth)** y autorización contra el **padrón
central `acceso`** (app `lectores`). Barra y paleta del estándar visual
compartido (`plataforma/ui`).

## Más rápido que el Form

El Form tiene 20 preguntas, pero son **10 chequeos**: cada "Especificar
problemática" es el seguimiento del Sí/No anterior. Acá:

- Cada chequeo es **un toque**: tres pads grandes **Sí / No / No aplica** (52 px,
  pensados para usar en planta con el celular en la mano).
- El campo de problemática **aparece solo cuando hace falta** — cuando la
  respuesta no es la esperada. Si anduvo todo, no se escribe una sola letra.
- **"No aplica"** (para la estación que esa línea no tiene) no cuenta como
  problema y no exige texto: deja un campo opcional para aclarar por qué.
- Botón **"Anduvo todo bien"**: responde los 10 chequeos de una, y después se
  corrige el que falló. El caso normal se completa en segundos.
- Arriba se ve siempre **cuántas van** (`7 de 10`) y **cuántas tienen problema**.
- Nada se pierde: en el CSV salen las dos columnas por chequeo con la
  **numeración original del Form** (`1` y `2`, `3` y `4`, …).

## El circuito del conforme

```
Sistemas carga  →  Pendiente  →  el encargado firma   →  Conforme
                                 el encargado observa →  Observado
```

### El QR: dos celulares, no uno

En la línea, el que recorre con el celular es **el de Sistemas**, y el encargado
sólo da el conforme. Pero el firmante sale siempre de la sesión de Easy Auth, así
que el encargado no puede firmar en el teléfono de Sistemas: sería la firma de
Sistemas con otro nombre.

El puente son dos celulares y un QR:

```
Sistemas guarda  →  le aparece el QR  →  el encargado lo escanea con SU celular
                                      →  entra con su usuario (SSO) y firma
                    la pantalla de Sistemas se entera sola y muestra quién firmó
```

- El QR codifica `https://verificacion.offalexpsa.ar/firmar/<id>`, y esa pantalla
  muestra **sólo esa verificación**: el encargado llega de la cámara, lee y
  decide, sin pestañas ni listados.
- **El link no es una credencial.** Lleva únicamente el número de verificación:
  quien lo abra tiene que autenticarse igual y tener rol de encargado del sector.
  Que el QR se filtre no habilita a nadie a firmar.
- Mientras el QR está en pantalla, la app de Sistemas pregunta cada 4 segundos si
  ya firmaron, hasta 10 minutos. Si el encargado no estaba, la verificación queda
  pendiente y el QR se vuelve a sacar desde el detalle, con
  **“Pedirle el conforme al encargado”**.
- Si el encargado no tiene el celular a mano, el mismo link se copia con un botón
  y se le manda por donde sea.

### Las reglas de la firma

- **La firma es la identidad de la sesión.** El firmante sale de la cabecera de
  Easy Auth, nunca de un campo del formulario: nadie firma en nombre de otro.
  Queda registrado nombre, correo, fecha y hora, y el comentario.
- **No firma quien cargó.** Por defecto, el usuario que cargó la verificación no
  puede darle el conforme (`PERMITIR_AUTOFIRMA=false`). Es lo que hace que la
  firma valga algo.
- **El sector manda.** El encargado de Insumos no firma verificaciones de
  Empaque (ver `config/roles.js`). Dentro del sector, firma el encargado del
  turno que quedó registrado en la verificación.
- **Una sola firma por verificación.** Si dos encargados entran a la vez, el
  segundo recibe un aviso en vez de pisar la firma del primero.
- **Observar exige comentario**: es el rechazo del conforme y tiene que decir
  por qué.

## El cuestionario se define en un solo archivo

Todo está en **`config/formConfig.js`**: las 6 secciones, los 10 chequeos (texto,
número en el Form original, ayuda, respuesta esperada), las respuestas posibles
(incluido el `No aplica`) y los campos de la cabecera. De ahí salen el formulario, la validación del servidor, el detalle y
el CSV. **No hay ninguna pregunta escrita a mano en el cliente.**

Agregar, sacar o reescribir una pregunta **no necesita migración**: las
respuestas se guardan como filas (pregunta + respuesta + problemática), no como
columnas. Sólo si cambia la *cabecera* (fecha, sector, turno…) hay que generar
una migración nueva:

```bash
npm run migracion > db/migrations/002-descripcion.sql
```

Cada fila del detalle guarda **la pregunta tal como se hizo**, así que cambiar el
cuestionario más adelante no reescribe lo que ya se firmó.

## Correr en local

```bash
cp .env.example .env     # o MODO_DEMO=true: no hay base de test
npm ci && npm --prefix client ci
npm run client:build     # compila el frontend
npm start                # http://localhost:3008
```

Desarrollo con recarga del frontend (dos terminales):

```bash
npm start                # backend en :3008
npm run client           # Vite en :5178, proxy /api
```

### Modo demo (sin base)

Para mostrarle el formulario a la gente de planta antes de tener App Service y
base, en el `.env`:

```env
MODO_DEMO=true
ALLOW_DEV_LOGIN=true
DEV_EMAIL=tu.usuario@offalexpsa.ar
PERMITIR_AUTOFIRMA=true   # para recorrer el circuito completo con un solo usuario
```

Arranca sin base, con dos verificaciones de ejemplo, y **guarda en memoria**: lo
que se cargue se pierde al reiniciar. Estas variables no se cargan nunca en Azure.

## Base de datos

Base compartida `controletiquetas`, esquema propio **`sistemas`**:

| Tabla | Qué guarda |
| --- | --- |
| `sistemas.VerificacionLectores` | una fila por verificación: cabecera, estado y firma del conforme |
| `sistemas.VerificacionLectoresDetalle` | una fila por chequeo: sección, pregunta, respuesta, problemática y si fue falla |

El DDL está en [`db/migrations/001-sistemas-verificacion-lectores.sql`](db/migrations/001-sistemas-verificacion-lectores.sql),
es idempotente y lo corre Sistemas a mano. **La app no crea ni modifica nada al
arrancar** (regla del estándar Offal). El esquema `sistemas` es nuevo, así que no
choca con `acceso`, `ingresos`, `comun`, `lavados` ni `dbo`.

## Permisos

Rol en `acceso.Permisos` para la app `lectores` (ver `config/roles.js`):

| Rol | Puede |
| --- | --- |
| `sistemas` | cargar verificaciones |
| `encargado_insumos` | firmar las de Insumos |
| `encargado_empaque` | firmar las de Empaque |
| `encargado` | firmar las de cualquier sector |
| `admin` | cargar y firmar todo |

Mientras `LECTORES_REQUIRE_PERMISSION=false`, cualquier usuario autenticado puede
cargar y firmar. Se pone en `true` cuando la app y los roles estén cargados en el
padrón.

## Estructura

```
index.js                     Express: /health, /api/me, /api/form-config, monta /api/verificaciones
routes/verificaciones.js     carga, listados, detalle y conforme (validación incluida)
services/store.js            SQL (y memoria en modo demo)
config/formConfig.js         ← el cuestionario entero se define acá
config/roles.js              quién carga y quién firma
config/db.js                 copia de plataforma/plantillas (+ MODO_DEMO)
middlewares/auth.js          copia de plataforma/plantillas (APP_KEY = 'lectores')
middlewares/errores.js       copia de plataforma/plantillas
lib/modulos.js               copia de plataforma/plantillas ("Mis módulos" de la barra)
scripts/generar-migracion.js DDL de la cabecera a partir de formConfig.js
client/src/ui/               copia de plataforma/ui — NO editar acá
```

`client/src/ui` se actualiza con `bash scripts/ui-sync.sh ../controlEstadoImpresoras client`
desde el repo `plataforma`, y se verifica con `--check`.

## Deploy (Azure)

App Service **`verificacionlectores`**, RG `GeneralApps`, plan
`ASP-GeneralApps-b922` (compartido con `panol`: sumar la app no costó plan nuevo).
Host: `verificacionlectores-apbga2brg9c3fpce.westus3-01.azurewebsites.net`.

Hecho:

- [x] App Service: Linux `NODE|24-lts`, Startup Command `npm start`,
      Health check `/health`, HTTPS only, TLS 1.2, Always On.
- [x] SCM basic auth On. El publish profile del portal vuelve **tapado con
      `REDACTED`** igual que en `presupuesto` y `camiones`, así que el secret se
      armó a mano desde `az webapp deployment list-publishing-credentials` con
      `publishMethod="ZipDeploy"`.
- [x] Secret `AZUREAPPSERVICE_PUBLISHPROFILE_VERIFICACIONLECTORES` en GitHub.
- [x] Easy Auth v2 con registro propio en Entra (`verificacionlectores`,
      AzureADMyOrg), token store On y `excludedPaths: ["/health"]` para que el
      probe no quede tapado por el login.
- [x] App Settings: `APP_ENV`/`NODE_ENV=production`, `DB_*` (usuario
      `app_lectores`), `LECTORES_REQUIRE_PERMISSION=false`,
      `PERMITIR_AUTOFIRMA=false`, `CORS_ORIGINS` vacío. **Sin** `ALLOW_DEV_LOGIN`
      ni `MODO_DEMO`.

Falta:

- [ ] Crear el usuario contenido `app_lectores` en `controletiquetas` y correr
      `db/migrations/001-*.sql`. Hasta que esté, la app levanta pero `/health`
      responde 503 y no se puede cargar nada.
- [ ] Alta de la app `lectores` en `acceso.Apps` y `acceso.Permisos`: completar
      los mails en [`db/acceso-alta-lectores.sql`](db/acceso-alta-lectores.sql)
      y correrlo. Después pasar `LECTORES_REQUIRE_PERMISSION=true`.
- [ ] Quitar `proximamente: true` de la tarjeta en `portal-offal/config/apps.js`
      y setear `URL_VERIFICACION_LECTORES`.

Push a `main` deploya a producción. **No hay ambiente de test**: no existe el
App Service `-test`, ni la base `controletiquetas-test`, ni la rama `develop`.
`test.yml` queda como molde y saltea el deploy.
Mientras no exista el secret, el workflow compila y saltea el deploy.

> El repositorio se llama `controlEstadoImpresoras` porque nació para otro
> control. El módulo es **Verificación de Lectores**: conviene renombrar el repo
> en GitHub (Settings → Rename) a `verificacionLectores` y actualizar el remoto.

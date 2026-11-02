# Verificación de Lectores

Sistema web interno de Offal. Reemplaza el Microsoft Form "VERIFICACIÓN DE
LECTORES". Lo usan Sistemas (hace la prueba de los lectores de la línea y carga
la verificación) y los encargados de turno de Insumos y Empaque (dan el conforme).

> El repo se llama `controlEstadoImpresoras` por un arranque anterior; el módulo
> es Verificación de Lectores. Si se renombra el repo, actualizar el remoto.

## Stack (no cambiar sin motivo)

- Express (CommonJS) en `index.js`, sirve `client/dist` y expone `/api`.
- React 18 + Vite en `client/`. Llama a rutas relativas `/api`.
- Azure SQL compartida `controletiquetas`, esquema propio **`sistemas`**. Padrón central `acceso`.
- Identidad: Azure Easy Auth (Entra ID). Autorización: `acceso.Permisos` con `App = 'lectores'`.
- Deploy: GitHub Actions → App Service `verificacionlectores` (RG `GeneralApps`,
  plan `ASP-GeneralApps-b922`), prod, rama `main`. **No hay ambiente de test**:
  no existe el App Service `-test`, ni `controletiquetas-test`, ni la rama
  `develop`; todo el DDL va a producción.

## Cómo correr

```bash
cp .env.example .env    # o MODO_DEMO=true: no hay base de test
npm ci && npm --prefix client ci
npm run dev             # backend :3008
npm run client          # Vite :5178, proxy /api
```

Sin base: `MODO_DEMO=true` + `ALLOW_DEV_LOGIN=true` (ver README).

## Lo propio de este sistema

- **Una verificación es UN recorrido, no la planta entera.** Cada estación
  pertenece a un sector (`SECCIONES[].sector`): Armado de cajas → Insumos;
  Troneras, Empaque, Rechazo y Balanza → Empaque; Rechazo despostada →
  Despostada. Quien carga elige el recorrido y responde sólo esas estaciones;
  ese mismo sector define qué encargado firma. Los sectores se derivan de las
  estaciones: una estación con un sector nuevo crea el recorrido, pero hay que
  darle su rol en `config/roles.js` y cargar encargados en el padrón, o nadie
  va a poder firmarlo.
- **Las estaciones con más de una unidad llevan sorteo.** Armado 4, Troneras 10,
  Empaque 3, Balanza 3 (`SECCIONES[].unidad`). El formulario sortea cuál se
  verifica y guarda las dos cosas: la sorteada y la verificada. Cambiarla exige
  motivo escrito, y el servidor lo valida. Sin eso el sorteo no sirve de nada.
- **El servidor limpia lo que no es del recorrido**: unidades de otros sectores
  y respuestas de otras estaciones no se guardan.
- **No hay atajo para responder todo de una.** Se sacó el botón "Anduvo todo
  bien" (2026-11-02): cada chequeo es una prueba que alguien hace en la línea.
- **`config/formConfig.js` es la fuente de verdad del cuestionario.** Secciones,
  chequeos, texto de cada pregunta, número en el Form original y respuesta
  esperada. El cliente no tiene ni una pregunta escrita a mano, y el servidor
  arma el detalle desde ahí (el texto de la pregunta NO se toma del body).
- **Las respuestas son filas, no columnas.** Cambiar el cuestionario no pide
  migración. Sólo la cabecera (`CAMPOS_VISITA`) tiene una columna por campo;
  si cambia, `npm run migracion > db/migrations/NNN-descripcion.sql`.
- **Cada fila guarda la pregunta tal como se hizo**: cambiar el cuestionario no
  reescribe lo ya firmado.
- **`EsFalla` lo calcula el servidor** comparando con `esperado` (y descartando
  `No aplica`). Es lo que se cuenta como problema en los listados; no se confía
  en el cliente.
- **Si la respuesta es "No", la problemática es obligatoria** (lo valida el
  servidor, no sólo el formulario). **"No aplica" no es falla**: no exige texto
  y no cuenta como problema; el campo queda opcional para aclarar por qué.
- **El conforme no se escribe, se firma.** El firmante sale siempre de
  `req.user` (Easy Auth). Ningún endpoint acepta "firmado por" desde el body.
- **El QR son dos celulares.** El de Sistemas recorre la línea; el encargado
  firma desde el suyo, entrando por `/firmar/<id>` (ver `client/src/lib/ruta.js`).
  Ese link **no es un token**: sólo lleva el id, y el servidor revalida rol y
  sector igual. No agregarle firmas por link ni tokens de un solo uso sin pensar
  qué pasa si el QR se saca por la ventana.
- **La ruta `/firmar/:id` la resuelve el cliente**, no el servidor: el
  `app.get('*')` de `index.js` sirve `index.html` para cualquier path y el SPA
  lee `window.location.pathname`. Si algún día se suman más rutas profundas,
  conviene un router en serio en vez de seguir parseando a mano.
- **Quien carga no firma** (`PERMITIR_AUTOFIRMA`), y el encargado sólo firma su
  sector (`config/roles.js`). Las dos reglas se verifican en el servidor: el
  cliente sólo oculta botones.
- El UPDATE del conforme es condicional sobre `Estado = 'Pendiente'`: no se pisa
  una firma ya dada.

## Resumen diario por correo

- `npm run resumen` mira el día anterior y manda correo **sólo si hubo menos de
  `RESUMEN_MINIMO` (3) verificaciones**. Si el día llegó al mínimo, no manda
  nada: es un aviso por excepción, decidido así por Sistemas el 2026-11-02.
- Cuenta por el campo `fecha` (el día recorrido), no por `CreadoEn`: cargar a la
  madrugada la recorrida de ayer cuenta para ayer.
- Lo dispara un cron, NO la app: `.github/workflows/resumen-diario.yml` (o un
  WebJob del App Service con las mismas variables). El script corre una vez y
  sale; sale con 1 si no pudo enviar, para que el cron lo marque en rojo.
- `services/mailer.js` es el único que sabe cómo viaja el correo. Sin SMTP
  configurado no falla en silencio: loguea el mail y devuelve `enviado: false`.

## Reglas del estándar Offal (ver `_plataforma/EVALUACION-PLATAFORMA.md` punto 6)

- `middlewares/auth.js`, `middlewares/errores.js`, `config/db.js` y `lib/modulos.js`
  son copias de las plantillas de la plataforma. Si hay que cambiarlos, cambiar la
  plantilla y propagar. Única excepción documentada: el bloque `MODO_DEMO` de
  `config/db.js` (sacar cuando el módulo esté en Azure).
- `client/src/ui/**` es copia de `plataforma/ui`: no se edita acá. Se sincroniza
  con `ui-sync.sh` y se verifica con `--check`. El CSS propio va en
  `client/src/index.css`, sin colores a mano y sin otros breakpoints que 520 y 820.
- Dev-login solo con `ALLOW_DEV_LOGIN=true`. Nunca por `NODE_ENV`.
- CORS solo detrás de `CORS_ORIGINS`. En producción queda vacío.
- Queries siempre con `.input()`. Nada de template strings con datos del request.
- Al cliente `{ mensaje }`. `err.message` solo al log.
- Cambios de esquema en `db/migrations/NNN-descripcion.sql`, idempotentes. Nunca DDL al arrancar.
- No leer tablas del esquema de otro sistema; pedir una vista al dueño.
- Nunca commitear `.env` ni `.claude/settings.local.json`.
- Push a `origin` únicamente. Cada push a `main` deploya a producción.

## Qué no tocar

- El bloque de `concurrency` de los workflows (evita el 409).
- El `/health` público (probe del App Service).
- El `beforeAll` de `test/smoke.test.js`: asigna los flags en 'false' en vez de
  borrarlos justamente para que el `.env` local no se filtre al test.

## Pendientes

- Base: crear el usuario contenido `app_lectores` en `controletiquetas` y correr
  la migración 001. Sin eso la app levanta pero `/health` da 503.
- Alta de `lectores` en `acceso` y después `LECTORES_REQUIRE_PERMISSION=true`.
- Tarjeta del portal (`portal-offal/config/apps.js`, sacar `proximamente`).
- Dominio productivo: `https://verificacion.offalexpsa.ar` (ya con certificado).
- El `turno` es obligatorio porque firma el encargado de ese turno. Si algún día
  el conforme deja de depender del turno, se afloja en `CAMPOS_VISITA`.

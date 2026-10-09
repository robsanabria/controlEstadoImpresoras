# Verificación de Lectores

Sistema web interno de Offal. Reemplaza el Microsoft Form "VERIFICACIÓN DE
LECTORES". Lo usan Sistemas (hace la prueba de los lectores de la línea y carga
la verificación) y los encargados de Insumos y Empaque (dan el conforme).

> El repo se llama `controlEstadoImpresoras` por un arranque anterior; el módulo
> es Verificación de Lectores. Si se renombra el repo, actualizar el remoto.

## Stack (no cambiar sin motivo)

- Express (CommonJS) en `index.js`, sirve `client/dist` y expone `/api`.
- React 18 + Vite en `client/`. Llama a rutas relativas `/api`.
- Azure SQL compartida `controletiquetas`, esquema propio **`sistemas`**. Padrón central `acceso`.
- Identidad: Azure Easy Auth (Entra ID). Autorización: `acceso.Permisos` con `App = 'lectores'`.
- Deploy: GitHub Actions → App Service `verificacion-lectores-offal` (prod, rama `main`)
  y `verificacion-lectores-offal-test` (test, rama `develop`).

## Cómo correr

```bash
cp .env.example .env    # apuntar a controletiquetas-test
npm ci && npm --prefix client ci
npm run dev             # backend :3008
npm run client          # Vite :5178, proxy /api
```

Sin base: `MODO_DEMO=true` + `ALLOW_DEV_LOGIN=true` (ver README).

## Lo propio de este sistema

- **`config/formConfig.js` es la fuente de verdad del cuestionario.** Secciones,
  chequeos, texto de cada pregunta, número en el Form original y respuesta
  esperada. El cliente no tiene ni una pregunta escrita a mano, y el servidor
  arma el detalle desde ahí (el texto de la pregunta NO se toma del body).
- **Las respuestas son filas, no columnas.** Cambiar el cuestionario no pide
  migración. Sólo la cabecera (`CAMPOS_VISITA`) tiene una columna por campo;
  si cambia, `npm run migracion > db/migrations/NNN-descripcion.sql`.
- **Cada fila guarda la pregunta tal como se hizo**: cambiar el cuestionario no
  reescribe lo ya firmado.
- **`EsFalla` lo calcula el servidor** comparando con `esperado`. Es lo que se
  cuenta como problema en los listados; no se confía en el cliente.
- **Si la respuesta no es la esperada, la problemática es obligatoria** (lo
  valida el servidor, no sólo el formulario).
- **El conforme no se escribe, se firma.** El firmante sale siempre de
  `req.user` (Easy Auth). Ningún endpoint acepta "firmado por" desde el body.
- **Quien carga no firma** (`PERMITIR_AUTOFIRMA`), y el encargado sólo firma su
  sector (`config/roles.js`). Las dos reglas se verifican en el servidor: el
  cliente sólo oculta botones.
- El UPDATE del conforme es condicional sobre `Estado = 'Pendiente'`: no se pisa
  una firma ya dada.

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

- Infra: App Service, Easy Auth, migración 001 y alta de `lectores` en `acceso`.
- Confirmar con planta si alguna pregunta necesita "No aplica" además de Sí/No.

// Tests mínimos obligatorios por repo. Atrapan el 80 % de los incidentes de auth.
// npm i -D vitest supertest
// package.json: "test": "vitest run"
// Requiere que index.js exporte la app sin hacer listen cuando se importa desde tests:
//   if (require.main === module) app.listen(PORT, ...); module.exports = app;

// vitest corre en ESM: el test se escribe con import y el server (CommonJS) se
// carga con createRequire. Con require('vitest') falla al arrancar.
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const request = require('supertest');

let app;

beforeAll(() => {
  // Sin base ni dev-login: el middleware tiene que responder 401/503, nunca 200.
  //
  // Se ASIGNAN en 'false' en vez de borrarse: index.js hace dotenv.config() al
  // cargarse y dotenv no pisa lo que ya está en process.env. Si acá se borraran,
  // el .env local (que en modo demo tiene ALLOW_DEV_LOGIN=true) entraría al test
  // y /api/me devolvería 200 sin cabecera de Easy Auth.
  process.env.ALLOW_DEV_LOGIN = 'false';
  process.env.MODO_DEMO = 'false';
  process.env.IMPRESORAS_REQUIRE_PERMISSION = 'false';
  process.env.DB_USER = process.env.DB_USER || 'x';
  process.env.DB_PASS = process.env.DB_PASS || 'x';
  process.env.DB_SERVER = process.env.DB_SERVER || 'localhost';
  process.env.DB_NAME = process.env.DB_NAME || 'x';
  app = require('../index');
});

describe('smoke', () => {
  it('GET /health responde (200 u 503, nunca 404)', async () => {
    const r = await request(app).get('/health');
    expect([200, 503]).toContain(r.status);
  });

  it('GET /api/me sin cabecera de Easy Auth devuelve 401', async () => {
    const r = await request(app).get('/api/me');
    expect(r.status).toBe(401);
  });

  it('una ruta protegida sin identidad no devuelve datos', async () => {
    // Ruta real del sistema: el listado de verificaciones
    const r = await request(app).get('/api/verificaciones');
    expect([401, 404]).toContain(r.status);
    expect(r.status).not.toBe(200);
  });

  it('una ruta de API inexistente devuelve JSON 404, no el index.html', async () => {
    const r = await request(app).get('/api/no-existe');
    expect(r.status).toBe(404);
    expect(r.headers['content-type']).toMatch(/json/);
  });
});

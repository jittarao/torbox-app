import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
} from './helpers/backendTestHelper.js';
import { setupStremioAddonsRoutes } from '../stremioAddons.js';
import { setupTmdbRoutes } from '../tmdb.js';

describe('user DB migration ensure on getUserDatabase', () => {
  let env;
  let server;
  let port;

  beforeEach(async () => {
    env = await createBackendTestEnv();
    const app = buildBackendApp({
      masterDatabase: env.masterDatabase,
      userDatabaseManager: env.userDatabaseManager,
      routeSetupFn: (app, backend) => {
        setupStremioAddonsRoutes(app, backend);
        setupTmdbRoutes(app, backend);
      },
    });
    server = app.listen(0);
    port = server.address().port;
  });

  afterEach(() => {
    server?.close();
    cleanupBackendTestEnv(env);
  });

  async function get(path) {
    const res = await fetch(`http://127.0.0.1:${port}${path}?authId=${env.authId}`, {
      headers: { 'x-api-key': env.apiKey },
    });
    return { status: res.status, body: await res.json() };
  }

  test('GET /api/stremio/addons returns empty list for a fresh user', async () => {
    const { status, body } = await get('/api/stremio/addons');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.addons).toEqual([]);
  });

  test('pooled connection applies any pending migrations before serving routes', async () => {
    // Simulate a long-lived pool entry opened before migrations 024/025 existed:
    // markers and tables are gone, but the handle stays pooled.
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    userDb.db.prepare('DELETE FROM schema_migrations WHERE version IN (?, ?)').run('024', '025');
    userDb.db.prepare('DROP TABLE IF EXISTS stremio_addons').run();
    userDb.db.prepare('DROP TABLE IF EXISTS tmdb_credentials').run();
    env.userDatabaseManager.releaseConnection(env.authId);

    expect(
      userDb.db
        .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='stremio_addons'")
        .get()
    ).toBeFalsy();

    const stremio = await get('/api/stremio/addons');
    expect(stremio.status).toBe(200);
    expect(stremio.body.success).toBe(true);
    expect(Array.isArray(stremio.body.addons)).toBe(true);

    const tmdb = await get('/api/tmdb/credentials');
    expect(tmdb.status).toBe(200);
    expect(tmdb.body).toEqual({ success: true, configured: false });
  });
});

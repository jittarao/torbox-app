import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
} from './helpers/backendTestHelper.js';
import { setupStremioAddonsRoutes } from '../stremioAddons.js';

describe('GET /api/stremio/addons', () => {
  let env;
  let server;
  let port;

  beforeEach(async () => {
    env = await createBackendTestEnv();
    const app = buildBackendApp({
      masterDatabase: env.masterDatabase,
      userDatabaseManager: env.userDatabaseManager,
      routeSetupFn: setupStremioAddonsRoutes,
    });
    server = app.listen(0);
    port = server.address().port;
  });

  afterEach(() => {
    server?.close();
    cleanupBackendTestEnv(env);
  });

  async function listAddons() {
    const res = await fetch(`http://127.0.0.1:${port}/api/stremio/addons?authId=${env.authId}`, {
      headers: { 'x-api-key': env.apiKey },
    });
    const body = await res.json();
    return { status: res.status, body };
  }

  test('returns empty addons list for a fresh user', async () => {
    const { status, body } = await listAddons();
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.addons).toEqual([]);
  });

  test('applies pending migrations on pooled connections before listing', async () => {
    // Open + migrate (creates stremio_addons), keep connection pooled.
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

    // Simulate a long-lived pool entry opened before migration 024 existed:
    // schema_migrations and tables for 024/025 are gone, but the handle stays pooled.
    userDb.db.prepare('DELETE FROM schema_migrations WHERE version IN (?, ?)').run('024', '025');
    userDb.db.prepare('DROP TABLE IF EXISTS stremio_addons').run();
    userDb.db.prepare('DROP TABLE IF EXISTS tmdb_credentials').run();
    // Pretend this connection last applied migrations through 023 only.
    userDb.schemaVersion = 23;
    env.userDatabaseManager.releaseConnection(env.authId);

    const missing = userDb.db
      .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='stremio_addons'")
      .get();
    expect(missing).toBeFalsy();

    const { status, body } = await listAddons();
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.addons)).toBe(true);
  });

  test('self-heals when schema_migrations claims 024 applied but table is missing', async () => {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    userDb.db.prepare('DROP TABLE IF EXISTS stremio_addons').run();
    // Leave 024 marked applied and schemaVersion current — pool thinks migrations are done.
    userDb.schemaVersion = await env.userDatabaseManager.getLatestUserMigrationVersion();
    env.userDatabaseManager.releaseConnection(env.authId);

    const { status, body } = await listAddons();
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.addons).toEqual([]);
  });
});

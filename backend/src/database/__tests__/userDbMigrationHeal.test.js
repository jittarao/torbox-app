import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
} from '../../routes/__tests__/helpers/backendTestHelper.js';
import { setupArchivedDownloadsRoutes } from '../../routes/archivedDownloads.js';
import { setupLinkHistoryRoutes } from '../../routes/linkHistory.js';
import { auditStremioTmdbSchema, inspectStremioTmdbTables } from '../stremioTmdbSchemaCheck.js';

describe('user DB migration resilience + stremio/tmdb schema audit', () => {
  let env;
  let server;
  let port;

  beforeEach(async () => {
    env = await createBackendTestEnv();
    const app = buildBackendApp({
      masterDatabase: env.masterDatabase,
      userDatabaseManager: env.userDatabaseManager,
      routeSetupFn: (app, backend) => {
        setupArchivedDownloadsRoutes(app, backend);
        setupLinkHistoryRoutes(app, backend);
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

  test('unpadded ALTER migration markers do not 500 user-DB routes', async () => {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

    for (const version of ['016', '017', '018']) {
      const unpadded = String(parseInt(version, 10));
      const row = userDb.db
        .prepare('SELECT name FROM schema_migrations WHERE version = ?')
        .get(version);
      userDb.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(version);
      userDb.db
        .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
        .run(unpadded, row?.name || 'legacy');
    }
    env.userDatabaseManager.releaseConnection(env.authId);
    env.userDatabaseManager.closeConnection(env.authId);

    const archived = await get('/api/archived-downloads?page=1&limit=50');
    expect(archived.status).toBe(200);
    expect(archived.body.success).toBe(true);

    const links = await get('/api/link-history?page=1&limit=50');
    expect(links.status).toBe(200);
    expect(links.body.success).toBe(true);
  });

  test('audit reports missing stremio/tmdb tables without creating them', async () => {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    userDb.db.prepare('DROP TABLE IF EXISTS stremio_addons').run();
    userDb.db.prepare('DROP TABLE IF EXISTS tmdb_credentials').run();
    env.userDatabaseManager.releaseConnection(env.authId);
    env.userDatabaseManager.closeConnection(env.authId);

    const summary = await auditStremioTmdbSchema(env.masterDatabase, env.userDatabaseManager);
    expect(summary.usersChecked).toBeGreaterThanOrEqual(1);
    expect(summary.usersWithMissingTables).toBe(1);
    expect(summary.missingStremioAddons).toBe(1);
    expect(summary.missingTmdbCredentials).toBe(1);
    expect(summary.healNeeded).toBe(true);

    // Audit must not heal — tables still missing.
    const reopened = await env.userDatabaseManager.getUserDatabase(env.authId);
    expect(inspectStremioTmdbTables(reopened.db).missing).toEqual([
      'stremio_addons',
      'tmdb_credentials',
    ]);
    env.userDatabaseManager.closeConnection(env.authId);
  });
});

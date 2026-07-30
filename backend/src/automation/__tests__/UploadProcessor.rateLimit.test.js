import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import request from 'supertest';
import UploadProcessor from '../UploadProcessor.js';
import {
  RATE_LIMIT_DEFERRAL_MESSAGE,
  TORBOX_UNCACHED_CREATE_LIMIT,
  syncAllRateLimitDeferrals,
  UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE,
} from '../uploadDeferral.js';
import {
  buildUploadApp,
  cleanupUploadTestEnv,
  createUploadTestEnv,
} from '../../routes/__tests__/helpers/uploadTestHelper.js';

function torboxHeaders({ limit = 60, remaining = 59, resetSeconds = 3600 } = {}) {
  return {
    'x-ratelimit-limit': String(limit),
    'x-ratelimit-remaining': String(remaining),
    'x-ratelimit-reset': String(resetSeconds),
    'retry-after': String(resetSeconds),
  };
}

describe('UploadProcessor TorBox rate-limit headers', () => {
  let env;

  beforeEach(async () => {
    env = await createUploadTestEnv();
  });

  afterEach(() => {
    cleanupUploadTestEnv(env);
  });

  async function withUserDb(fn) {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    try {
      return await fn(userDb);
    } finally {
      env.userDatabaseManager.releaseConnection(env.authId);
    }
  }

  test('updateRateLimitFromResponse caches remaining and limit from success response', async () => {
    await withUserDb(() => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 12, limit: 60 }),
      });

      const snapshot = processor.getRateLimitStatisticsForUser(env.authId).torrent;
      expect(snapshot.known).toBe(true);
      expect(snapshot.remaining).toBe(12);
      expect(snapshot.limit).toBe(60);
      expect(snapshot.used).toBe(48);
    });
  });

  test('calculateRateLimitDelay uses shorter retry-after when blocking', async () => {
    await withUserDb(() => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 0, resetSeconds: 120 }),
      });

      const { waitMs, uncached } = processor.calculateRateLimitDelay(
        {
          response: {
            status: 429,
            headers: {
              'x-ratelimit-limit': '60',
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': '120',
              'retry-after': '45',
            },
          },
        },
        env.authId,
        'torrent'
      );

      expect(uncached).toBe(true);
      expect(waitMs).toBeGreaterThan(40_000);
      expect(waitMs).toBeLessThanOrEqual(45_000);
    });
  });

  test('calculateRateLimitDelay falls back to external retry when headers and attempts are missing', async () => {
    await withUserDb(() => {
      const processor = new UploadProcessor(null, { updateUploadCounters: async () => {} });
      const { waitMs, uncached } = processor.calculateRateLimitDelay(
        {
          response: {
            status: 429,
            data: { detail: '60 per 1 hour' },
            headers: {},
          },
        },
        env.authId,
        'torrent'
      );
      expect(uncached).toBe(true);
      expect(waitMs).toBe(5 * 60 * 1000);
    });
  });

  test('calculateRateLimitDelay uses oldest uncached attempt when 429 has no headers', async () => {
    await withUserDb((userDb) => {
      const uploadId = userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:old', 'old', 'completed', 0)
        `
        )
        .run().lastInsertRowid;
      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          VALUES (?, 'torrent', 200, 1, 0, datetime('now', '-50 minutes'))
        `
        )
        .run(uploadId);

      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      const { waitMs, uncached } = processor.calculateRateLimitDelay(
        {
          response: {
            status: 429,
            data: { detail: '60 per 1 hour' },
            headers: {},
          },
        },
        env.authId,
        'torrent',
        userDb
      );

      expect(uncached).toBe(true);
      // ~10 minutes until oldest attempt ages out of the hour window
      expect(waitMs).toBeGreaterThan(5 * 60 * 1000);
      expect(waitMs).toBeLessThanOrEqual(15 * 60 * 1000);
    });
  });

  test('cached rate-limit headers do not overwrite uncached gating state', async () => {
    await withUserDb(() => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 5, limit: 60, resetSeconds: 1800 }),
      });
      processor.updateRateLimitFromResponse(
        env.authId,
        'torrent',
        { headers: torboxHeaders({ remaining: 297, limit: 300, resetSeconds: 30 }) },
        { isCached: true }
      );
      // Also ignore by limit alone (without isCached flag)
      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 297, limit: 300, resetSeconds: 30 }),
      });

      const state = processor.getRateLimitState(env.authId, 'torrent');
      expect(state.remaining).toBe(5);
      expect(state.limit).toBe(60);
    });
  });

  test('cached-header 429 does not overwrite uncached gating state', async () => {
    await withUserDb(() => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 5, limit: 60, resetSeconds: 1800 }),
      });

      const { waitMs, uncached } = processor.calculateRateLimitDelay(
        {
          response: {
            status: 429,
            data: { detail: 'too many requests' },
            headers: torboxHeaders({ remaining: 0, limit: 300, resetSeconds: 30 }),
          },
        },
        env.authId,
        'torrent'
      );

      expect(uncached).toBe(false);
      expect(waitMs).toBe(5 * 60 * 1000);
      const state = processor.getRateLimitState(env.authId, 'torrent');
      expect(state.remaining).toBe(5);
      expect(state.limit).toBe(60);
    });
  });

  test('handleSuccessfulUpload logs cached responses for audit badges', async () => {
    await withUserDb((userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:abc', 'cached test', 'processing', 0)
        `
        )
        .run();

      const uploadId = userDb.db.prepare('SELECT last_insert_rowid() as id').get().id;

      processor.handleSuccessfulUpload({ id: uploadId, authId: env.authId }, userDb, 'torrent', {
        status: 200,
        headers: torboxHeaders({ remaining: 10 }),
        data: {
          success: true,
          detail: 'Found Cached Torrent',
          data: { hash: 'abc', torrent_id: 1, auth_id: 'x' },
        },
      });

      const row = userDb.db
        .prepare('SELECT is_cached FROM upload_attempts WHERE upload_id = ?')
        .get(uploadId);
      expect(row?.is_cached).toBe(1);
    });
  });

  test('proactive defer when uncached remaining is zero', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });

      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 0, resetSeconds: 1800 }),
      });

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:ghi', 'deferred', 'processing', 0)
        `
        )
        .run();

      const uploadId = userDb.db.prepare('SELECT last_insert_rowid() as id').get().id;
      let apiCalled = false;
      processor.getApiClient = async () => ({});
      processor.makeApiRequest = async () => {
        apiCalled = true;
        return { status: 200, data: { success: true, data: {} } };
      };

      const result = await processor.processUpload(
        { id: uploadId, type: 'torrent', authId: env.authId, upload_type: 'magnet' },
        userDb
      );

      expect(result.success).toBe(false);
      expect(result.stopTypeDrain).toBe(true);
      expect(apiCalled).toBe(false);

      const row = userDb.db
        .prepare('SELECT status, next_attempt_at, error_message FROM uploads WHERE id = ?')
        .get(uploadId);
      expect(row.status).toBe('queued');
      expect(row.next_attempt_at).not.toBeNull();
      expect(row.error_message).toBe(UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE);
    });
  });

  test('successful create updates headers and stops drain when remaining reaches zero', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:abc', 'last-slot', 'processing', 0)
        `
        )
        .run();

      const uploadId = userDb.db.prepare('SELECT last_insert_rowid() as id').get().id;
      processor.getApiClient = async () => ({});
      processor.makeApiRequest = async () => ({
        status: 200,
        headers: torboxHeaders({ remaining: 0, resetSeconds: 600 }),
        data: {
          success: true,
          detail: 'Torrent added',
          data: { hash: 'abc', torrent_id: 1, auth_id: 'x' },
        },
      });

      const result = await processor.processUpload(
        { id: uploadId, type: 'torrent', authId: env.authId, upload_type: 'magnet' },
        userDb,
        'processing'
      );

      expect(result.success).toBe(true);
      expect(result.stopTypeDrain).toBe(true);
      expect(processor.getRateLimitState(env.authId, 'torrent').remaining).toBe(0);
    });
  });

  test('handleIdempotentDuplicate logs once as cached for audit', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:dup', 'duplicate', 'processing', 0)
        `
        )
        .run();

      const uploadId = userDb.db.prepare('SELECT last_insert_rowid() as id').get().id;

      const apiClient = {
        getTorrents: async () => [
          {
            id: 999,
            hash: 'abcdef0123456789abcdef0123456789abcdef01',
            auth_id: 'torbox-auth',
            name: 'duplicate',
          },
        ],
      };

      const completed = await processor.handleIdempotentDuplicate(
        {
          id: uploadId,
          authId: env.authId,
          type: 'torrent',
          upload_type: 'magnet',
          url: 'magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01',
          name: 'duplicate',
        },
        userDb,
        'torrent',
        {
          status: 200,
          data: {
            success: false,
            error: 'DUPLICATE_ITEM',
            detail: 'Download already queued.',
          },
        },
        apiClient
      );

      expect(completed).toBe(true);

      const attempts = userDb.db
        .prepare('SELECT is_cached FROM upload_attempts WHERE upload_id = ?')
        .all(uploadId);
      expect(attempts).toHaveLength(1);
      expect(attempts[0].is_cached).toBe(1);
    });
  });

  test('429 responses are not logged to upload_attempts', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:def', 'rate limited', 'processing', 0)
        `
        )
        .run();

      const uploadId = userDb.db.prepare('SELECT last_insert_rowid() as id').get().id;

      await processor.handleFailedUpload(
        { id: uploadId, authId: env.authId, retry_count: 0 },
        userDb,
        'torrent',
        {
          response: {
            status: 429,
            data: { detail: '60 per 1 hour' },
            headers: torboxHeaders({ remaining: 0, resetSeconds: 300 }),
          },
          message: 'Request failed with status code 429',
        }
      );

      const row = userDb.db
        .prepare('SELECT id FROM upload_attempts WHERE upload_id = ?')
        .get(uploadId);
      expect(row).toBeNull();
      expect(processor.getRateLimitState(env.authId, 'torrent').remaining).toBe(0);
    });
  });

  test('429 applies shared cooldown to siblings using server reset time', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:current', 'current', 'processing', 0),
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:sibling', 'sibling', 'queued', 1)
        `
        )
        .run();

      const currentId = userDb.db.prepare(`SELECT id FROM uploads WHERE name = 'current'`).get().id;

      await processor.handleFailedUpload(
        { id: currentId, authId: env.authId, retry_count: 0 },
        userDb,
        'torrent',
        {
          response: {
            status: 429,
            data: { detail: '60 per 1 hour' },
            headers: torboxHeaders({ remaining: 0, resetSeconds: 240 }),
          },
          message: 'Request failed with status code 429',
        }
      );

      const sibling = userDb.db
        .prepare(
          `SELECT status, next_attempt_at, error_message FROM uploads WHERE name = 'sibling'`
        )
        .get();
      expect(sibling.status).toBe('queued');
      expect(sibling.next_attempt_at).not.toBeNull();
      expect(sibling.error_message).toBe(UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE);
    });
  });
});

describe('GET /api/uploads rate-limit statistics', () => {
  let env;
  let app;

  beforeEach(async () => {
    env = await createUploadTestEnv();
    env.uploadProcessor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
    app = buildUploadApp(env);
    env.uploadProcessor.updateRateLimitFromResponse(env.authId, 'torrent', {
      headers: torboxHeaders({ remaining: 42, limit: 60, resetSeconds: 1200 }),
    });
    env.uploadProcessor.updateRateLimitFromResponse(env.authId, 'usenet', {
      headers: torboxHeaders({ remaining: 10, limit: 60, resetSeconds: 900 }),
    });
  });

  afterEach(() => {
    cleanupUploadTestEnv(env);
  });

  test('returns per-type server quota snapshots from processor cache', async () => {
    const res = await request(app).get('/api/uploads').set('x-api-key', env.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.uploadStatistics.byType.torrent.known).toBe(true);
    expect(res.body.uploadStatistics.byType.torrent.remaining).toBe(42);
    expect(res.body.uploadStatistics.byType.torrent.limit).toBe(60);
    expect(res.body.uploadStatistics.byType.usenet.remaining).toBe(10);
    expect(res.body.uploadStatistics.byType.webdl.known).toBe(false);
  });

  test('returns deferred queue counts from queued uploads', async () => {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    try {
      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'a', 'queued', 0, datetime('now', '+30 minutes'), ?),
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:b', 'b', 'queued', 1, datetime('now', '+45 minutes'), ?)
        `
        )
        .run(RATE_LIMIT_DEFERRAL_MESSAGE, RATE_LIMIT_DEFERRAL_MESSAGE);
    } finally {
      env.userDatabaseManager.releaseConnection(env.authId);
    }

    const res = await request(app).get('/api/uploads').set('x-api-key', env.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.uploadStatistics.byType.torrent.deferredCount).toBe(2);
    expect(res.body.uploadStatistics.byType.torrent.deferredUntil).not.toBeNull();
    expect(res.body.uploadStatistics.retryAt).not.toBeNull();
  });

  test('returns uncached window usage from recent upload_attempts', async () => {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    try {
      const uploadId = userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:infer', 'infer', 'completed', 0)
        `
        )
        .run().lastInsertRowid;

      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          VALUES
            (?, 'torrent', 200, 1, 0, datetime('now', '-20 minutes')),
            (?, 'torrent', 200, 1, 1, datetime('now', '-10 minutes'))
        `
        )
        .run(uploadId, uploadId);
    } finally {
      env.userDatabaseManager.releaseConnection(env.authId);
    }

    const res = await request(app).get('/api/uploads').set('x-api-key', env.apiKey);

    expect(res.status).toBe(200);
    const window = res.body.uploadStatistics.byType.torrent.window;
    expect(window).toBeDefined();
    expect(window.uncachedUsed).toBe(1);
    expect(window.uncachedLimit).toBe(60);
    expect(window.totalUsed).toBeUndefined();
    expect(window.totalLimit).toBeUndefined();
    expect(window.uncachedResetAt).not.toBeNull();
  });
});

describe('UploadProcessor uncached create quota pause', () => {
  let env;

  beforeEach(async () => {
    env = await createUploadTestEnv();
  });

  afterEach(() => {
    cleanupUploadTestEnv(env);
  });

  async function withUserDb(fn) {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    try {
      return await fn(userDb);
    } finally {
      env.userDatabaseManager.releaseConnection(env.authId);
    }
  }

  function seedUncachedAttempts(userDb, count) {
    for (let i = 0; i < count; i++) {
      const uploadId = userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES ('torrent', 'magnet', ?, ?, 'completed', ?)
        `
        )
        .run(`magnet:?xt=urn:btih:seed${i}`, `seed-${i}`, i).lastInsertRowid;
      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          VALUES (?, 'torrent', 200, 1, 0, datetime('now', '-20 minutes'))
        `
        )
        .run(uploadId);
    }
  }

  test('processUpload defers without calling TorBox when uncached quota is exhausted', async () => {
    await withUserDb(async (userDb) => {
      seedUncachedAttempts(userDb, TORBOX_UNCACHED_CREATE_LIMIT);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:next', 'next', 'queued', 0),
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:sib', 'sibling', 'queued', 1)
        `
        )
        .run();

      const nextId = userDb.db.prepare(`SELECT id FROM uploads WHERE name = 'next'`).get().id;

      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      // Cached short-window headers must not clear uncached DB gating.
      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 200, limit: 300, resetSeconds: 3600 }),
      });
      // Uncached headers still show remaining, but DB uncached budget is exhausted.
      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 40, limit: 60, resetSeconds: 3600 }),
      });

      let apiCalled = false;
      processor.getApiClient = async () => ({});
      processor.makeApiRequest = async () => {
        apiCalled = true;
        throw new Error('should not call API');
      };

      const result = await processor.processUpload(
        { id: nextId, type: 'torrent', authId: env.authId, upload_type: 'magnet' },
        userDb,
        'queued',
        false
      );

      expect(apiCalled).toBe(false);
      expect(result.success).toBe(false);
      expect(result.stopTypeDrain).toBe(true);

      const next = userDb.db
        .prepare(`SELECT next_attempt_at, error_message FROM uploads WHERE id = ?`)
        .get(nextId);
      expect(next.next_attempt_at).not.toBeNull();
      expect(next.error_message).toContain('Uncached rate limit');

      const sibling = userDb.db
        .prepare(`SELECT next_attempt_at, error_message FROM uploads WHERE name = 'sibling'`)
        .get();
      expect(sibling.next_attempt_at).not.toBeNull();
      expect(sibling.error_message).toContain('Uncached rate limit');
    });
  });

  test('processUpload continues when only cached creates fill most of the total budget', async () => {
    await withUserDb(async (userDb) => {
      for (let i = 0; i < 80; i++) {
        const uploadId = userDb.db
          .prepare(
            `
            INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
            VALUES ('torrent', 'magnet', ?, ?, 'completed', ?)
          `
          )
          .run(`magnet:?xt=urn:btih:c${i}`, `cached-${i}`, i).lastInsertRowid;
        userDb.db
          .prepare(
            `
            INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
            VALUES (?, 'torrent', 200, 1, 1, datetime('now', '-10 minutes'))
          `
          )
          .run(uploadId);
      }
      seedUncachedAttempts(userDb, 10);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:go', 'go', 'processing', 0)
        `
        )
        .run();
      const uploadId = userDb.db.prepare(`SELECT id FROM uploads WHERE name = 'go'`).get().id;

      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 40, limit: 60, resetSeconds: 3600 }),
      });
      processor.getApiClient = async () => ({});
      processor.makeApiRequest = async () => ({
        status: 200,
        headers: torboxHeaders({ remaining: 297, limit: 300 }),
        data: {
          success: true,
          detail: 'Found Cached Torrent',
          data: { hash: 'abc', torrent_id: 1, auth_id: 'x' },
        },
      });

      const result = await processor.processUpload(
        { id: uploadId, type: 'torrent', authId: env.authId, upload_type: 'magnet' },
        userDb,
        'processing',
        false
      );

      expect(result.success).toBe(true);
      expect(result.stopTypeDrain).toBe(false);
      // Cached headers must not overwrite uncached remaining=40 state.
      expect(processor.getRateLimitState(env.authId, 'torrent').remaining).toBe(40);
      expect(processor.getRateLimitState(env.authId, 'torrent').limit).toBe(60);
    });
  });

  test('rate-limit sync keeps uncached pauses while cached headers still report remaining', async () => {
    await withUserDb(async (userDb) => {
      seedUncachedAttempts(userDb, TORBOX_UNCACHED_CREATE_LIMIT);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:paused', 'paused', 'queued', 0, datetime('now', '+30 minutes'), ?)
        `
        )
        .run(UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE);

      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 200, limit: 300, resetSeconds: 3600 }),
      });
      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: torboxHeaders({ remaining: 40, limit: 60, resetSeconds: 3600 }),
      });

      const sync = processor.getRateLimitSyncContext(env.authId, userDb);
      expect(sync.getAvailability('torrent')).toBe('blocked');
      expect(sync.isBlocked('torrent')).toBe(true);

      const result = syncAllRateLimitDeferrals(userDb, sync);
      expect(result.released).toBe(0);

      const row = userDb.db
        .prepare(`SELECT next_attempt_at FROM uploads WHERE name = 'paused'`)
        .get();
      expect(row.next_attempt_at).not.toBeNull();
    });
  });
});

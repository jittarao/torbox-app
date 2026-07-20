import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import request from 'supertest';
import UploadProcessor from '../UploadProcessor.js';
import {
  buildUploadApp,
  cleanupUploadTestEnv,
  createUploadTestEnv,
} from '../../routes/__tests__/helpers/uploadTestHelper.js';

describe('UploadProcessor uncached rate limits', () => {
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

  test('countUncachedAttemptsSince excludes cached attempts', async () => {
    await withUserDb((userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          VALUES (1, 'torrent', 200, 1, 0, datetime('now', '-10 minutes')),
                 (2, 'torrent', 200, 1, 1, datetime('now', '-5 minutes'))
        `
        )
        .run();

      expect(processor.countUncachedAttemptsSince(userDb, 'torrent')).toBe(1);
    });
  });

  test('calculateRateLimitDelay uses rolling window when uncached budget is full', async () => {
    await withUserDb((userDb) => {
      const processor = new UploadProcessor(null, { updateUploadCounters: async () => {} });

      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          SELECT value, 'torrent', 200, 1, 0, datetime('now', '-55 minutes')
          FROM (SELECT 1 AS value UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
                UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
                UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
                UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
                UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
                UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
                UNION ALL SELECT 31 UNION ALL SELECT 32 UNION ALL SELECT 33 UNION ALL SELECT 34 UNION ALL SELECT 35
                UNION ALL SELECT 36 UNION ALL SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39 UNION ALL SELECT 40
                UNION ALL SELECT 41 UNION ALL SELECT 42 UNION ALL SELECT 43 UNION ALL SELECT 44 UNION ALL SELECT 45
                UNION ALL SELECT 46 UNION ALL SELECT 47 UNION ALL SELECT 48 UNION ALL SELECT 49 UNION ALL SELECT 50
                UNION ALL SELECT 51 UNION ALL SELECT 52 UNION ALL SELECT 53 UNION ALL SELECT 54 UNION ALL SELECT 55
                UNION ALL SELECT 56 UNION ALL SELECT 57 UNION ALL SELECT 58 UNION ALL SELECT 59 UNION ALL SELECT 60)
        `
        )
        .run();

      const error = {
        response: {
          status: 429,
          data: { detail: '60 per 1 hour' },
          headers: {},
        },
      };

      const delayMs = processor.calculateRateLimitDelay(error, userDb, 'torrent');
      expect(delayMs).toBeGreaterThan(0);
      expect(delayMs).toBeLessThan(60 * 60 * 1000);
    });
  });

  test('calculateRateLimitDelay uses short retry when external 429 has no local window data', async () => {
    await withUserDb((userDb) => {
      const processor = new UploadProcessor(null, { updateUploadCounters: async () => {} });
      const error = {
        response: {
          status: 429,
          data: { detail: '60 per 1 hour' },
          headers: {},
        },
      };

      const delayMs = processor.calculateRateLimitDelay(error, userDb, 'torrent');
      expect(delayMs).toBe(60 * 1000);
    });
  });

  test('handleSuccessfulUpload logs cached responses without consuming uncached budget', async () => {
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

      expect(processor.countUncachedAttemptsSince(userDb, 'torrent')).toBe(0);
    });
  });

  test('proactive defer when uncached hourly limit is reached', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });

      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          SELECT value, 'torrent', 200, 1, 0, datetime('now', '-30 minutes')
          FROM (SELECT 1 AS value UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
                UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
                UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
                UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
                UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
                UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
                UNION ALL SELECT 31 UNION ALL SELECT 32 UNION ALL SELECT 33 UNION ALL SELECT 34 UNION ALL SELECT 35
                UNION ALL SELECT 36 UNION ALL SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39 UNION ALL SELECT 40
                UNION ALL SELECT 41 UNION ALL SELECT 42 UNION ALL SELECT 43 UNION ALL SELECT 44 UNION ALL SELECT 45
                UNION ALL SELECT 46 UNION ALL SELECT 47 UNION ALL SELECT 48 UNION ALL SELECT 49 UNION ALL SELECT 50
                UNION ALL SELECT 51 UNION ALL SELECT 52 UNION ALL SELECT 53 UNION ALL SELECT 54 UNION ALL SELECT 55
                UNION ALL SELECT 56 UNION ALL SELECT 57 UNION ALL SELECT 58 UNION ALL SELECT 59 UNION ALL SELECT 60)
        `
        )
        .run();

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

      expect(result).toBe(false);
      expect(apiCalled).toBe(false);

      const row = userDb.db
        .prepare('SELECT status, next_attempt_at FROM uploads WHERE id = ?')
        .get(uploadId);
      expect(row.status).toBe('queued');
      expect(row.next_attempt_at).not.toBeNull();
    });
  });

  test('handleIdempotentDuplicate logs once as cached and does not consume uncached budget', async () => {
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
      expect(processor.countUncachedAttemptsSince(userDb, 'torrent')).toBe(0);
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
            headers: {},
          },
          message: 'Request failed with status code 429',
        }
      );

      const row = userDb.db
        .prepare('SELECT id FROM upload_attempts WHERE upload_id = ?')
        .get(uploadId);
      expect(row).toBeNull();
    });
  });
});

describe('GET /api/uploads uncached statistics', () => {
  let env;
  let app;

  beforeEach(async () => {
    env = await createUploadTestEnv();
    app = buildUploadApp(env);
  });

  afterEach(() => {
    cleanupUploadTestEnv(env);
  });

  test('returns per-type uncached counts from upload_attempts', async () => {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    try {
      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          VALUES
            (1, 'torrent', 200, 1, 0, datetime('now', '-20 minutes')),
            (2, 'torrent', 200, 1, 1, datetime('now', '-15 minutes')),
            (3, 'usenet', 200, 1, 0, datetime('now', '-10 minutes'))
        `
        )
        .run();
    } finally {
      env.userDatabaseManager.releaseConnection(env.authId);
    }

    const res = await request(app).get('/api/uploads').set('x-api-key', env.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.uploadStatistics.lastHour.torrents.uncached).toBe(1);
    expect(res.body.uploadStatistics.lastHour.usenets.uncached).toBe(1);
    expect(res.body.uploadStatistics.lastHour.webdls.uncached).toBe(0);
    expect(res.body.uploadStatistics.rateLimit.uncachedPerHour).toBe(60);
  });
});

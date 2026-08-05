import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import UploadProcessor from '../UploadProcessor.js';
import {
  RATE_LIMIT_DEFERRAL_MESSAGE,
  UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE,
} from '../uploadDeferral.js';
import {
  cleanupUploadTestEnv,
  createUploadTestEnv,
} from '../../routes/__tests__/helpers/uploadTestHelper.js';

describe('UploadProcessor buffered round-robin drain', () => {
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

  function insertQueuedUpload(userDb, { type, name, queueOrder }) {
    userDb.db
      .prepare(
        `
        INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
        VALUES (?, 'magnet', ?, ?, 'queued', ?)
      `
      )
      .run(type, `magnet:?xt=urn:btih:${String(queueOrder).padStart(40, '0')}`, name, queueOrder);
    return userDb.db.prepare('SELECT last_insert_rowid() as id').get().id;
  }

  test('torrent-only queue uses full work cap (25)', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

      for (let i = 0; i < 30; i++) {
        insertQueuedUpload(userDb, { type: 'torrent', name: `t-${i}`, queueOrder: i });
      }

      let processed = 0;
      processor.processUpload = async () => {
        processed++;
        return { success: true, stopTypeDrain: false };
      };

      const originalClaim = processor._claimAndProcessUpload.bind(processor);
      processor._claimAndProcessUpload = async (upload, authId, db) => {
        const row = db.db.prepare('SELECT status FROM uploads WHERE id = ?').get(upload.id);
        if (row?.status !== 'queued') {
          return { userDb: db, outcome: null };
        }
        db.db
          .prepare(
            `UPDATE uploads SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
          )
          .run(upload.id);
        await processor.processUpload(upload, db, 'queued', false);
        return { userDb: db, outcome: { success: true, stopTypeDrain: false } };
      };

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(25);
      expect(processed).toBe(25);

      const remaining = userDb.db
        .prepare(`SELECT COUNT(*) as count FROM uploads WHERE status = 'queued'`)
        .get().count;
      expect(remaining).toBe(5);
    });
  });

  test('round-robin interleaves types instead of starving usenet', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

      for (let i = 0; i < 20; i++) {
        insertQueuedUpload(userDb, { type: 'torrent', name: `t-${i}`, queueOrder: i * 3 });
      }
      insertQueuedUpload(userDb, { type: 'usenet', name: 'u-0', queueOrder: 1 });
      insertQueuedUpload(userDb, { type: 'usenet', name: 'u-1', queueOrder: 4 });

      const order = [];
      processor.processUpload = async (upload) => {
        order.push(upload.type);
        return { success: true, stopTypeDrain: false };
      };

      processor._claimAndProcessUpload = async (upload, authId, db) => {
        const row = db.db.prepare('SELECT status FROM uploads WHERE id = ?').get(upload.id);
        if (row?.status !== 'queued') {
          return { userDb: db, outcome: null };
        }
        db.db
          .prepare(
            `UPDATE uploads SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
          )
          .run(upload.id);
        await processor.processUpload(upload, db, 'queued', false);
        return { userDb: db, outcome: { success: true, stopTypeDrain: false } };
      };

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(22);
      expect(order.filter((t) => t === 'usenet').length).toBe(2);
      expect(order.indexOf('usenet')).toBeLessThan(order.lastIndexOf('torrent'));
    });
  });

  test('getQueuedUploads default limit is 1', async () => {
    await withUserDb((userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      insertQueuedUpload(userDb, { type: 'torrent', name: 'a', queueOrder: 0 });
      insertQueuedUpload(userDb, { type: 'torrent', name: 'b', queueOrder: 1 });

      const rows = processor.getQueuedUploads(userDb, env.authId, 'torrent');
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('a');
    });
  });

  test('buffer amortizes SQL fetches', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

      for (let i = 0; i < 10; i++) {
        insertQueuedUpload(userDb, { type: 'torrent', name: `t-${i}`, queueOrder: i });
      }

      let torrentFetchCount = 0;
      const originalGet = processor.getQueuedUploads.bind(processor);
      processor.getQueuedUploads = (db, authId, type, opts) => {
        if (type === 'torrent') {
          torrentFetchCount++;
        }
        return originalGet(db, authId, type, opts);
      };

      processor.processUpload = async () => ({ success: true, stopTypeDrain: false });
      processor._claimAndProcessUpload = async (upload, authId, db) => {
        db.db
          .prepare(
            `UPDATE uploads SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
          )
          .run(upload.id);
        await processor.processUpload(upload, db, 'queued', false);
        return { userDb: db, outcome: { success: true, stopTypeDrain: false } };
      };

      await processor._drainUserQueues(env.authId, userDb);
      expect(torrentFetchCount).toBe(1);
    });
  });

  test('429 stops type but allows other types in same drain', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

      insertQueuedUpload(userDb, { type: 'torrent', name: 't-0', queueOrder: 0 });
      insertQueuedUpload(userDb, { type: 'torrent', name: 't-1', queueOrder: 1 });
      insertQueuedUpload(userDb, { type: 'usenet', name: 'u-0', queueOrder: 2 });

      let torrentCalls = 0;
      processor.processUpload = async (upload) => {
        if (upload.type === 'torrent') {
          torrentCalls++;
          if (torrentCalls === 2) {
            return { success: false, stopTypeDrain: true };
          }
        }
        return { success: true, stopTypeDrain: false };
      };

      processor._claimAndProcessUpload = async (upload, authId, db) => {
        const outcome = await processor.processUpload(upload, db, 'queued', false);
        return { userDb: db, outcome };
      };

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBeGreaterThanOrEqual(2);
      expect(torrentCalls).toBe(2);
    });
  });

  test('cached header state proactively gates without SQLite budget queries', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });

      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: {
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1800',
        },
      });

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:budget', 'budget-test', 'processing', 0)
        `
        )
        .run();
      const uploadId = userDb.db.prepare('SELECT last_insert_rowid() as id').get().id;

      processor.getApiClient = async () => ({});
      processor.makeApiRequest = async () => {
        throw new Error('should not call API');
      };

      const result = await processor.processUpload(
        { id: uploadId, type: 'torrent', authId: env.authId, upload_type: 'magnet' },
        userDb,
        'processing',
        false
      );

      expect(result.success).toBe(false);
      expect(result.stopTypeDrain).toBe(true);
    });
  });

  test('processUpload does not call getTorrents during drain path', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      insertQueuedUpload(userDb, { type: 'torrent', name: 't-0', queueOrder: 0 });

      let getTorrentsCalled = false;
      processor.getApiClient = async () => ({
        getTorrents: async () => {
          getTorrentsCalled = true;
          return [];
        },
      });
      processor.processUpload = async () => ({ success: true, stopTypeDrain: false });
      processor._claimAndProcessUpload = async (upload, authId, db) => {
        await processor.getApiClient(authId);
        await processor.processUpload(upload, db, 'queued', false);
        return { userDb: db, outcome: { success: true, stopTypeDrain: false } };
      };

      await processor._drainUserQueues(env.authId, userDb);
      expect(getTorrentsCalled).toBe(false);
    });
  });
});

describe('UploadProcessor drain integration (real claim path)', () => {
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

  function insertQueuedUpload(userDb, { type, name, queueOrder }) {
    userDb.db
      .prepare(
        `
        INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
        VALUES (?, 'magnet', ?, ?, 'queued', ?)
      `
      )
      .run(type, `magnet:?xt=urn:btih:${String(queueOrder).padStart(40, '0')}`, name, queueOrder);
    return userDb.db.prepare('SELECT last_insert_rowid() as id').get().id;
  }

  function stubTorboxCreateApi(
    processor,
    { cached = false, delayMs = 0, remaining = 59, limit = 60, resetSeconds = 3600 } = {}
  ) {
    processor.getApiClient = async () => ({
      client: {
        defaults: {
          headers: { Authorization: 'Bearer test', 'User-Agent': 'test' },
        },
      },
    });
    processor.buildFormData = async () => ({
      getHeaders: () => ({ 'content-type': 'multipart/form-data' }),
    });
    let calls = 0;
    processor.makeApiRequest = async () => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      calls++;
      const responseRemaining = calls === 1 ? remaining : Math.max(0, remaining - 1);
      return {
        status: 200,
        headers: {
          'x-ratelimit-limit': String(limit),
          'x-ratelimit-remaining': String(responseRemaining),
          'x-ratelimit-reset': String(resetSeconds),
        },
        data: {
          success: true,
          detail: cached ? 'Found Cached Torrent' : 'Download created',
          data: {
            hash: 'abcdef0123456789abcdef0123456789abcdef01',
            torrent_id: 1,
            usenet_id: 2,
            webdl_id: 3,
            auth_id: 'torbox-auth',
          },
        },
      };
    };
  }

  test('work cap with real optimistic claims completes exactly 25 uploads', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      stubTorboxCreateApi(processor);

      for (let i = 0; i < 30; i++) {
        insertQueuedUpload(userDb, { type: 'torrent', name: `t-${i}`, queueOrder: i });
      }

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(25);

      const completed = userDb.db
        .prepare(`SELECT COUNT(*) as count FROM uploads WHERE status = 'completed'`)
        .get().count;
      expect(completed).toBe(25);

      const queued = userDb.db
        .prepare(`SELECT COUNT(*) as count FROM uploads WHERE status = 'queued'`)
        .get().count;
      expect(queued).toBe(5);

      const processing = userDb.db
        .prepare(`SELECT COUNT(*) as count FROM uploads WHERE status = 'processing'`)
        .get().count;
      expect(processing).toBe(0);
    });
  });

  test('buffer refetch: 60 torrents uses one SQL fetch and leaves 35 queued', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      stubTorboxCreateApi(processor);

      for (let i = 0; i < 60; i++) {
        insertQueuedUpload(userDb, { type: 'torrent', name: `t-${i}`, queueOrder: i });
      }

      let torrentFetchCount = 0;
      const originalGet = processor.getQueuedUploads.bind(processor);
      processor.getQueuedUploads = (db, authId, type, opts) => {
        if (type === 'torrent') {
          torrentFetchCount++;
        }
        return originalGet(db, authId, type, opts);
      };

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(25);
      expect(torrentFetchCount).toBe(1);

      const queued = userDb.db
        .prepare(`SELECT COUNT(*) as count FROM uploads WHERE status = 'queued'`)
        .get().count;
      expect(queued).toBe(35);
    });
  });

  test('strict round-robin ordering T-U-W across cycles', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
      stubTorboxCreateApi(processor);

      const types = ['torrent', 'usenet', 'webdl'];
      for (let cycle = 0; cycle < 2; cycle++) {
        for (let i = 0; i < types.length; i++) {
          insertQueuedUpload(userDb, {
            type: types[i],
            name: `${types[i]}-${cycle}`,
            queueOrder: cycle * 3 + i,
          });
        }
      }

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(6);

      const completedTypes = userDb.db
        .prepare(
          `
          SELECT type FROM uploads
          WHERE status = 'completed'
          ORDER BY id ASC
        `
        )
        .all()
        .map((row) => row.type);

      expect(completedTypes).toEqual(['torrent', 'usenet', 'webdl', 'torrent', 'usenet', 'webdl']);
    });
  });

  test('header quota defers queued uploads when remaining is zero', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });

      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: {
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1800',
        },
      });

      insertQueuedUpload(userDb, { type: 'torrent', name: 'budget-1', queueOrder: 0 });
      insertQueuedUpload(userDb, { type: 'torrent', name: 'budget-2', queueOrder: 1 });

      let apiCalls = 0;
      processor.getApiClient = async () => ({});
      processor.makeApiRequest = async () => {
        apiCalls++;
        return { status: 200, data: { success: true, data: {} } };
      };

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(0);
      expect(apiCalls).toBe(0);

      const rows = userDb.db
        .prepare(
          `SELECT name, status, next_attempt_at, error_message FROM uploads ORDER BY queue_order ASC`
        )
        .all();
      expect(rows.every((row) => row.status === 'queued')).toBe(true);
      expect(rows.every((row) => row.next_attempt_at != null)).toBe(true);
      expect(rows.every((row) => row.error_message === UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE)).toBe(
        true
      );
    });
  });

  test('releases stale rate-limit deferrals when quota is known available before draining', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

      processor.updateRateLimitFromResponse(env.authId, 'torrent', {
        headers: {
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '10',
          'x-ratelimit-reset': '3600',
        },
      });

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:ready', 'ready', 'queued', 0, datetime('now', '+4 minutes'), ?)
        `
        )
        .run(RATE_LIMIT_DEFERRAL_MESSAGE);

      stubTorboxCreateApi(processor, { remaining: 10 });

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(1);

      const row = userDb.db
        .prepare(`SELECT status, next_attempt_at FROM uploads WHERE name = 'ready'`)
        .get();
      expect(row.status).toBe('completed');
      expect(row.next_attempt_at).toBeNull();
    });
  });

  test('preserves rate-limit deferrals after restart when header cache is empty', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'deferred-a', 'queued', 0, datetime('now', '+30 minutes'), ?),
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:b', 'deferred-b', 'queued', 1, datetime('now', '+45 minutes'), ?)
        `
        )
        .run(RATE_LIMIT_DEFERRAL_MESSAGE, RATE_LIMIT_DEFERRAL_MESSAGE);

      let apiCalls = 0;
      processor.getApiClient = async () => ({});
      processor.makeApiRequest = async () => {
        apiCalls++;
        return { status: 200, data: { success: true, data: {} } };
      };

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(0);
      expect(apiCalls).toBe(0);

      const rows = userDb.db
        .prepare(
          `SELECT name, status, next_attempt_at, error_message FROM uploads ORDER BY queue_order ASC`
        )
        .all();
      expect(rows.every((row) => row.status === 'queued')).toBe(true);
      expect(rows.every((row) => row.next_attempt_at != null)).toBe(true);
      expect(rows.every((row) => row.error_message === UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE)).toBe(
        true
      );
    });
  });

  test('serializes concurrent drains for the same user', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

      for (let i = 0; i < 6; i++) {
        insertQueuedUpload(userDb, { type: 'torrent', name: `t-${i}`, queueOrder: i });
      }

      let inFlight = 0;
      let peakConcurrent = 0;
      stubTorboxCreateApi(processor, { delayMs: 15 });
      const originalMakeApiRequest = processor.makeApiRequest.bind(processor);
      processor.makeApiRequest = async (...args) => {
        inFlight++;
        peakConcurrent = Math.max(peakConcurrent, inFlight);
        try {
          return await originalMakeApiRequest(...args);
        } finally {
          inFlight--;
        }
      };

      await Promise.all([
        processor._drainUserQueues(env.authId, userDb),
        processor._drainUserQueues(env.authId, userDb),
      ]);

      expect(peakConcurrent).toBe(1);

      const completed = userDb.db
        .prepare(`SELECT COUNT(*) as count FROM uploads WHERE status = 'completed'`)
        .get().count;
      expect(completed).toBe(6);
    });
  });

  test('429 stops torrent type and continues other types with real claims', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });

      insertQueuedUpload(userDb, { type: 'torrent', name: 't-0', queueOrder: 0 });
      insertQueuedUpload(userDb, { type: 'torrent', name: 't-1', queueOrder: 1 });
      insertQueuedUpload(userDb, { type: 'usenet', name: 'u-0', queueOrder: 2 });

      let currentType = 'torrent';
      let torrentCalls = 0;
      processor.getApiClient = async () => ({
        client: {
          defaults: {
            headers: { Authorization: 'Bearer test', 'User-Agent': 'test' },
          },
        },
      });
      processor.buildFormData = async (upload) => {
        currentType = upload.type;
        return {
          getHeaders: () => ({ 'content-type': 'multipart/form-data' }),
        };
      };
      processor.makeApiRequest = async () => {
        if (currentType === 'torrent') {
          torrentCalls++;
          if (torrentCalls === 2) {
            throw Object.assign(new Error('Request failed with status code 429'), {
              response: {
                status: 429,
                data: { detail: '60 per 1 hour' },
                headers: {},
              },
            });
          }
        }
        return {
          status: 200,
          data: {
            success: true,
            detail: 'ok',
            data: {
              hash: 'abcdef0123456789abcdef0123456789abcdef01',
              torrent_id: 1,
              usenet_id: 2,
              webdl_id: 3,
              auth_id: 'torbox-auth',
            },
          },
        };
      };

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(3);
      expect(torrentCalls).toBe(2);

      const t1 = userDb.db
        .prepare(`SELECT status, next_attempt_at FROM uploads WHERE name = 't-1'`)
        .get();
      expect(t1.status).toBe('queued');
      expect(t1.next_attempt_at).not.toBeNull();

      const usenet = userDb.db.prepare(`SELECT status FROM uploads WHERE name = 'u-0'`).get();
      expect(usenet.status).toBe('completed');
    });
  });
});

describe('UploadProcessor closed-DB / pool race guards', () => {
  let env;

  beforeEach(async () => {
    env = await createUploadTestEnv();
  });

  afterEach(() => {
    cleanupUploadTestEnv(env);
  });

  test('closeConnection skips while pinned (pinCounts / activeOperations)', async () => {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId, { pin: true });

    expect(env.userDatabaseManager.closeConnection(env.authId)).toBe(false);
    expect(userDb.db.prepare('SELECT 1 as ok').get().ok).toBe(1);

    env.userDatabaseManager.markInactive(env.authId);
    expect(env.userDatabaseManager.closeConnection(env.authId)).toBe(true);
  });

  test('pin survives pool delete + reconnect so closeConnection still skips', async () => {
    await env.userDatabaseManager.getUserDatabase(env.authId, { pin: true });
    env.userDatabaseManager.pool.delete(env.authId);

    const reopened = await env.userDatabaseManager.getUserDatabase(env.authId);
    expect(env.userDatabaseManager.closeConnection(env.authId)).toBe(false);
    expect(reopened.db.prepare('SELECT 1 as ok').get().ok).toBe(1);

    env.userDatabaseManager.markInactive(env.authId);
    expect(env.userDatabaseManager.closeConnection(env.authId)).toBe(true);
  });

  test('claim finally reopens closed DB and resets stuck processing row', async () => {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

    userDb.db
      .prepare(
        `
        INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
        VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'stuck', 'queued', 1)
      `
      )
      .run();
    const uploadId = userDb.db.prepare('SELECT last_insert_rowid() as id').get().id;
    const upload = userDb.db.prepare('SELECT * FROM uploads WHERE id = ?').get(uploadId);

    processor.processUpload = async () => {
      env.userDatabaseManager.pool.delete(env.authId);
      return { success: false, stopTypeDrain: false };
    };

    const { outcome } = await processor._claimAndProcessUpload(upload, env.authId, userDb);
    expect(outcome.success).toBe(false);

    const freshDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    const row = freshDb.db.prepare('SELECT status FROM uploads WHERE id = ?').get(uploadId);
    expect(row.status).toBe('queued');
    env.userDatabaseManager.closeConnection(env.authId);
  });

  test('_processUserUploads pins via getUserDatabase and closes connection after drain', async () => {
    const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);
    processor._drainUserQueues = async () => ({ userDb: null, totalProcessed: 1 });

    // Pre-open so we can assert the handle is removed after drain (not left for idleTimeout).
    await env.userDatabaseManager.getUserDatabase(env.authId);
    expect(env.userDatabaseManager.pool.cache.has(env.authId)).toBe(true);

    await processor._processUserUploads(
      { auth_id: env.authId, queued_uploads_count: 1 },
      { shouldCleanup: false, shouldRecover: false }
    );

    expect(env.userDatabaseManager.pinCounts.get(env.authId) ?? 0).toBe(0);
    expect(env.userDatabaseManager.pool.cache.has(env.authId)).toBe(false);
  });
});

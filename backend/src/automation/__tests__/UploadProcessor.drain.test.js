import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import UploadProcessor from '../UploadProcessor.js';
import { UPLOAD_UNCACHED_LIMIT_PER_HOUR } from '../../config/uploadRateLimits.js';
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
      processor._claimAndProcessUpload = async (upload, authId, db, budgetCtx) => {
        const row = db.db.prepare('SELECT status FROM uploads WHERE id = ?').get(upload.id);
        if (row?.status !== 'queued') {
          return { userDb: db, outcome: null };
        }
        db.db
          .prepare(
            `UPDATE uploads SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
          )
          .run(upload.id);
        await processor.processUpload(upload, db, 'queued', false, budgetCtx);
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

      processor._claimAndProcessUpload = async (upload, authId, db, budgetCtx) => {
        const row = db.db.prepare('SELECT status FROM uploads WHERE id = ?').get(upload.id);
        if (row?.status !== 'queued') {
          return { userDb: db, outcome: null };
        }
        db.db
          .prepare(
            `UPDATE uploads SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
          )
          .run(upload.id);
        await processor.processUpload(upload, db, 'queued', false, budgetCtx);
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
      processor._claimAndProcessUpload = async (upload, authId, db, budgetCtx) => {
        db.db
          .prepare(
            `UPDATE uploads SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
          )
          .run(upload.id);
        await processor.processUpload(upload, db, 'queued', false, budgetCtx);
        return { userDb: db, outcome: { success: true, stopTypeDrain: false } };
      };

      await processor._drainUserQueues(env.authId, userDb);
      expect(torrentFetchCount).toBe(1);
    });
  });

  test('initializes uncached budgets upfront (three count queries)', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, env.masterDatabase);

      let countCalls = 0;
      const originalCount = processor.countUncachedAttemptsSince.bind(processor);
      processor.countUncachedAttemptsSince = (db, type) => {
        countCalls++;
        return originalCount(db, type);
      };

      processor.processUpload = async () => ({ success: true, stopTypeDrain: false });
      processor._claimAndProcessUpload = async () => ({
        userDb,
        outcome: { success: true, stopTypeDrain: false },
      });

      await processor._drainUserQueues(env.authId, userDb);
      expect(countCalls).toBe(3);
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

      processor._claimAndProcessUpload = async (upload, authId, db, budgetCtx) => {
        const outcome = await processor.processUpload(upload, db, 'queued', false, budgetCtx);
        return { userDb: db, outcome };
      };

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBeGreaterThanOrEqual(2);
      expect(torrentCalls).toBe(2);
    });
  });

  test('budgetCtx proactive gate without re-querying SQLite', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
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

      let limitChecks = 0;
      processor.isAtUncachedHourlyLimit = () => {
        limitChecks++;
        return false;
      };
      processor.getApiClient = async () => ({});
      processor.makeApiRequest = async () => {
        throw new Error('should not call API');
      };

      const budgetCtx = { remainingUncachedBudget: 0 };
      const result = await processor.processUpload(
        { id: uploadId, type: 'torrent', authId: env.authId, upload_type: 'magnet' },
        userDb,
        'processing',
        false,
        budgetCtx
      );

      expect(result.success).toBe(false);
      expect(result.stopTypeDrain).toBe(true);
      expect(limitChecks).toBe(0);
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
      processor._claimAndProcessUpload = async (upload, authId, db, budgetCtx) => {
        await processor.getApiClient(authId);
        await processor.processUpload(upload, db, 'queued', false, budgetCtx);
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

  function stubTorboxCreateApi(processor, { cached = false, delayMs = 0 } = {}) {
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
    processor.makeApiRequest = async () => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return {
        status: 200,
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

  test('in-memory uncached budget defers second upload without isAtUncachedHourlyLimit re-query', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });
      stubTorboxCreateApi(processor, { cached: false });

      const seedCount = UPLOAD_UNCACHED_LIMIT_PER_HOUR - 1;
      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          SELECT value, 'torrent', 200, 1, 0, datetime('now', '-30 minutes')
          FROM (
            WITH RECURSIVE cnt(x) AS (
              SELECT 1
              UNION ALL
              SELECT x + 1 FROM cnt WHERE x < ?
            )
            SELECT x AS value FROM cnt
          )
        `
        )
        .run(seedCount);

      insertQueuedUpload(userDb, { type: 'torrent', name: 'budget-1', queueOrder: 0 });
      insertQueuedUpload(userDb, { type: 'torrent', name: 'budget-2', queueOrder: 1 });

      let limitChecks = 0;
      processor.isAtUncachedHourlyLimit = () => {
        limitChecks++;
        return true;
      };

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(2);
      expect(limitChecks).toBe(0);

      const rows = userDb.db
        .prepare(`SELECT name, status, next_attempt_at FROM uploads ORDER BY queue_order ASC`)
        .all();
      expect(rows[0].status).toBe('completed');
      expect(rows[1].status).toBe('queued');
      expect(rows[1].next_attempt_at).not.toBeNull();
    });
  });

  test('cached responses do not decrement in-memory uncached budget during drain', async () => {
    await withUserDb(async (userDb) => {
      const processor = new UploadProcessor(env.userDatabaseManager, {
        updateUploadCounters: async () => {},
      });
      stubTorboxCreateApi(processor, { cached: true });

      const seedCount = UPLOAD_UNCACHED_LIMIT_PER_HOUR - 1;
      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          SELECT value, 'torrent', 200, 1, 0, datetime('now', '-30 minutes')
          FROM (
            WITH RECURSIVE cnt(x) AS (
              SELECT 1
              UNION ALL
              SELECT x + 1 FROM cnt WHERE x < ?
            )
            SELECT x AS value FROM cnt
          )
        `
        )
        .run(seedCount);

      insertQueuedUpload(userDb, { type: 'torrent', name: 'cached-1', queueOrder: 0 });
      insertQueuedUpload(userDb, { type: 'torrent', name: 'cached-2', queueOrder: 1 });

      const { totalProcessed } = await processor._drainUserQueues(env.authId, userDb);
      expect(totalProcessed).toBe(2);

      const completed = userDb.db
        .prepare(`SELECT COUNT(*) as count FROM uploads WHERE status = 'completed'`)
        .get().count;
      expect(completed).toBe(2);

      expect(processor.countUncachedAttemptsSince(userDb, 'torrent')).toBe(seedCount);
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

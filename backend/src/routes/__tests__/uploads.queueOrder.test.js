import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';
import DatabaseMaster from '../../database/Database.js';
import UserDatabaseManager from '../../database/UserDatabaseManager.js';

describe('upload queue_order assignment', () => {
  let tempDir;
  let masterDatabase;
  let userDatabaseManager;
  let authId;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'data', `test-upload-queue-order-${Date.now()}`);
    mkdirSync(path.join(tempDir, 'users'), { recursive: true });
    process.env.MASTER_DB_PATH = path.join(tempDir, 'master.db');
    process.env.USER_DB_DIR = path.join(tempDir, 'users');

    masterDatabase = new DatabaseMaster();
    await masterDatabase.initialize();

    authId = 'test-auth-queue-order';
    const dbPath = path.join(tempDir, 'users', `user_${authId}.sqlite`);
    masterDatabase.runQuery(
      `INSERT INTO user_registry (auth_id, db_path, status, queued_uploads_count, next_upload_attempt_at)
       VALUES (?, ?, 'active', 0, datetime('now', '+1 day'))`,
      [authId, dbPath]
    );

    userDatabaseManager = new UserDatabaseManager(masterDatabase, path.join(tempDir, 'users'));
  });

  afterEach(() => {
    masterDatabase?.close?.();
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.MASTER_DB_PATH;
    delete process.env.USER_DB_DIR;
  });

  function createSingleUploadTransaction(userDb) {
    return userDb.db.transaction((name) => {
      const maxOrderResult = userDb.db
        .prepare('SELECT MAX(queue_order) as max_order FROM uploads WHERE status = ?')
        .get('queued');
      const queueOrder = (maxOrderResult?.max_order ?? -1) + 1;
      const result = userDb.db
        .prepare(
          `INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, created_at, updated_at)
           VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:abc', ?, 'queued', ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        )
        .run(name, queueOrder);
      return { queueOrder, id: result.lastInsertRowid };
    });
  }

  function createBatchUploadTransaction(userDb) {
    return userDb.db.transaction((names) => {
      const maxOrderResult = userDb.db
        .prepare('SELECT MAX(queue_order) as max_order FROM uploads WHERE status = ?')
        .get('queued');
      let currentQueueOrder = (maxOrderResult?.max_order ?? -1) + 1;
      const insert = userDb.db.prepare(
        `INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, created_at, updated_at)
         VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:abc', ?, 'queued', ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      );
      const results = [];
      for (const name of names) {
        const result = insert.run(name, currentQueueOrder++);
        results.push(result.lastInsertRowid);
      }
      return results;
    });
  }

  function requeueFailedUpload(userDb, uploadId, queueOrder) {
    return (
      userDb.db
        .prepare(
          `UPDATE uploads
           SET status = 'queued',
               error_message = NULL,
               retry_count = 0,
               next_attempt_at = NULL,
               last_processed_at = NULL,
               queue_order = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status = 'failed'`
        )
        .run(queueOrder, uploadId).changes > 0
    );
  }

  function createRetryTransaction(userDb) {
    return userDb.db.transaction((uploadId) => {
      const maxOrderResult = userDb.db
        .prepare('SELECT MAX(queue_order) as max_order FROM uploads WHERE status = ?')
        .get('queued');
      const queueOrder = (maxOrderResult?.max_order ?? -1) + 1;
      const requeued = requeueFailedUpload(userDb, uploadId, queueOrder);
      return { queueOrder, requeued };
    });
  }

  function createBulkRetryTransaction(userDb) {
    return userDb.db.transaction((uploadIds) => {
      const maxOrderResult = userDb.db
        .prepare('SELECT MAX(queue_order) as max_order FROM uploads WHERE status = ?')
        .get('queued');
      let currentQueueOrder = (maxOrderResult?.max_order ?? -1) + 1;
      const retriedIds = [];
      for (const uploadId of uploadIds) {
        if (requeueFailedUpload(userDb, uploadId, currentQueueOrder)) {
          retriedIds.push(uploadId);
          currentQueueOrder++;
        }
      }
      return retriedIds;
    });
  }

  test('concurrent single create transactions assign distinct queue_order values', async () => {
    const userDb = await userDatabaseManager.getUserDatabase(authId);
    const create = createSingleUploadTransaction(userDb);

    // Seed an existing queued upload so MAX is non-trivial.
    create('seed');

    const [first, second] = await Promise.all([
      Promise.resolve().then(() => create('first')),
      Promise.resolve().then(() => create('second')),
    ]);

    expect(first.queueOrder).not.toBe(second.queueOrder);

    const orders = userDb.db
      .prepare('SELECT queue_order FROM uploads WHERE status = ? ORDER BY queue_order')
      .all('queued')
      .map((row) => row.queue_order);
    expect(orders).toEqual([0, 1, 2]);

    userDatabaseManager.closeConnection(authId);
  });

  test('batch create assigns contiguous queue_order values', async () => {
    const userDb = await userDatabaseManager.getUserDatabase(authId);
    const createBatch = createBatchUploadTransaction(userDb);

    createBatch(['seed-1', 'seed-2']);
    const ids = createBatch(['a', 'b', 'c']);

    const orders = userDb.db
      .prepare('SELECT id, queue_order FROM uploads WHERE status = ? ORDER BY queue_order')
      .all('queued')
      .map((row) => ({ id: row.id, queue_order: row.queue_order }));

    expect(orders.map((row) => row.queue_order)).toEqual([0, 1, 2, 3, 4]);
    expect(ids).toEqual(orders.slice(-3).map((row) => row.id));

    userDatabaseManager.closeConnection(authId);
  });

  test('concurrent retry transactions assign distinct queue_order values', async () => {
    const userDb = await userDatabaseManager.getUserDatabase(authId);
    const create = createSingleUploadTransaction(userDb);
    const seed = create('seed');

    const failedA = create('failed-a');
    const failedB = create('failed-b');
    userDb.db.prepare("UPDATE uploads SET status = 'failed' WHERE id IN (?, ?)").run(
      failedA.id,
      failedB.id
    );

    const retry = createRetryTransaction(userDb);

    const [first, second] = await Promise.all([
      Promise.resolve().then(() => retry(failedA.id)),
      Promise.resolve().then(() => retry(failedB.id)),
    ]);

    expect(first.requeued).toBe(true);
    expect(second.requeued).toBe(true);
    expect(first.queueOrder).not.toBe(second.queueOrder);
    expect(first.queueOrder).toBeGreaterThan(seed.queueOrder);
    expect(second.queueOrder).toBeGreaterThan(seed.queueOrder);

    const retriedOrders = userDb.db
      .prepare('SELECT queue_order FROM uploads WHERE id IN (?, ?) ORDER BY queue_order')
      .all(failedA.id, failedB.id)
      .map((row) => row.queue_order);
    expect(retriedOrders[0]).not.toBe(retriedOrders[1]);

    userDatabaseManager.closeConnection(authId);
  });

  test('bulk retry assigns distinct queue_order values', async () => {
    const userDb = await userDatabaseManager.getUserDatabase(authId);
    const create = createSingleUploadTransaction(userDb);
    const seed = create('seed');

    const failedA = create('failed-a');
    const failedB = create('failed-b');
    const failedC = create('failed-c');
    userDb.db
      .prepare("UPDATE uploads SET status = 'failed' WHERE id IN (?, ?, ?)")
      .run(failedA.id, failedB.id, failedC.id);

    const bulkRetry = createBulkRetryTransaction(userDb);
    const retriedIds = bulkRetry([failedA.id, failedB.id, failedC.id]);

    expect(retriedIds).toHaveLength(3);

    const retriedOrders = userDb.db
      .prepare('SELECT queue_order FROM uploads WHERE id IN (?, ?, ?) ORDER BY queue_order')
      .all(failedA.id, failedB.id, failedC.id)
      .map((row) => row.queue_order);
    expect(new Set(retriedOrders).size).toBe(3);
    expect(retriedOrders[0]).toBeGreaterThan(seed.queueOrder);

    userDatabaseManager.closeConnection(authId);
  });
});

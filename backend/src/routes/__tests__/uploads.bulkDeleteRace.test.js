import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';
import DatabaseMaster from '../../database/Database.js';
import UserDatabaseManager from '../../database/UserDatabaseManager.js';
import { deleteUploadAndDetermineStatus } from '../uploads.js';

describe('bulk upload delete status race', () => {
  let tempDir;
  let masterDatabase;
  let userDatabaseManager;
  const authId = 'test-auth-bulk-delete-race';

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'data', `test-bulk-delete-race-${Date.now()}`);
    mkdirSync(path.join(tempDir, 'users'), { recursive: true });
    process.env.MASTER_DB_PATH = path.join(tempDir, 'master.db');
    process.env.USER_DB_DIR = path.join(tempDir, 'users');

    masterDatabase = new DatabaseMaster();
    await masterDatabase.initialize();

    const dbPath = path.join(tempDir, 'users', `user_${authId}.sqlite`);
    masterDatabase.runQuery(
      `INSERT INTO user_registry (auth_id, db_path, status, queued_uploads_count, next_upload_attempt_at)
       VALUES (?, ?, 'active', 0, NULL)`,
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

  function getCounter() {
    return masterDatabase.getQuery(
      'SELECT queued_uploads_count FROM user_registry WHERE auth_id = ?',
      [authId]
    ).queued_uploads_count;
  }

  async function createProcessingUpload() {
    const userDb = await userDatabaseManager.getUserDatabase(authId);
    const result = userDb.db
      .prepare(
        `INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
         VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:abc', 'race test', 'processing', 0)`
      )
      .run();
    userDatabaseManager.closeConnection(authId);
    return result.lastInsertRowid;
  }

  test('decrements counter when processing upload is deleted atomically', async () => {
    const uploadId = await createProcessingUpload();
    masterDatabase.incrementUploadCounter(authId, null);
    expect(getCounter()).toBe(1);

    const userDb = await userDatabaseManager.getUserDatabase(authId);
    const upload = userDb.db
      .prepare('SELECT id, file_path, status, file_deleted, file_size_bytes FROM uploads WHERE id = ?')
      .get(uploadId);

    const result = await deleteUploadAndDetermineStatus(authId, upload, userDb, null);
    expect(result.deleted).toBe(true);
    expect(result.wasQueued).toBe(true);

    if (result.wasQueued) {
      masterDatabase.decrementUploadCounter(authId);
    }

    userDatabaseManager.closeConnection(authId);

    expect(getCounter()).toBe(0);
  });

  test('does not decrement counter when upload completes before delete transaction', async () => {
    const uploadId = await createProcessingUpload();
    masterDatabase.incrementUploadCounter(authId, null);
    expect(getCounter()).toBe(1);

    const userDb = await userDatabaseManager.getUserDatabase(authId);

    // Simulate the upload processor completing the upload after file deletion
    // but before the status-read/delete transaction runs.
    userDb.db.prepare("UPDATE uploads SET status = 'completed' WHERE id = ?").run(uploadId);

    const upload = userDb.db
      .prepare('SELECT id, file_path, status, file_deleted, file_size_bytes FROM uploads WHERE id = ?')
      .get(uploadId);

    const result = await deleteUploadAndDetermineStatus(authId, upload, userDb, null);
    expect(result.deleted).toBe(true);
    expect(result.wasQueued).toBe(false);

    userDatabaseManager.closeConnection(authId);

    expect(getCounter()).toBe(1);
  });
});

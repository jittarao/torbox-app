import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';
import DatabaseMaster from '../../database/Database.js';
import UserDatabaseManager from '../../database/UserDatabaseManager.js';

describe('upload counter drift repair', () => {
  let tempDir;
  let masterDatabase;
  let userDatabaseManager;
  let authId;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'data', `test-upload-counter-${Date.now()}`);
    mkdirSync(path.join(tempDir, 'users'), { recursive: true });
    process.env.MASTER_DB_PATH = path.join(tempDir, 'master.db');
    process.env.USER_DB_DIR = path.join(tempDir, 'users');

    masterDatabase = new DatabaseMaster();
    await masterDatabase.initialize();

    authId = 'test-auth-upload-counter';
    const dbPath = path.join(tempDir, 'users', `user_${authId}.sqlite`);
    masterDatabase.runQuery(
      `INSERT INTO user_registry (auth_id, db_path, status, queued_uploads_count, next_upload_attempt_at)
       VALUES (?, ?, 'active', 0, datetime('now', '+1 day'))`,
      [authId, dbPath]
    );

    userDatabaseManager = new UserDatabaseManager(masterDatabase, path.join(tempDir, 'users'));
    const userDb = await userDatabaseManager.getUserDatabase(authId);
    userDb.db
      .prepare(
        `
        INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
        VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:abc', 'stale queued', 'queued', 0)
      `
      )
      .run();
    userDatabaseManager.closeConnection(authId);
  });

  afterEach(() => {
    masterDatabase?.close?.();
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.MASTER_DB_PATH;
    delete process.env.USER_DB_DIR;
  });

  test('updateUploadCounters repairs zero master count with pending user uploads', async () => {
    const userDb = await userDatabaseManager.getUserDatabase(authId);

    const before = masterDatabase.getQuery(
      'SELECT queued_uploads_count, next_upload_attempt_at FROM user_registry WHERE auth_id = ?',
      [authId]
    );
    expect(before.queued_uploads_count).toBe(0);
    expect(before.next_upload_attempt_at).not.toBeNull();

    await masterDatabase.updateUploadCounters(authId, userDb);

    const after = masterDatabase.getQuery(
      'SELECT queued_uploads_count, next_upload_attempt_at FROM user_registry WHERE auth_id = ?',
      [authId]
    );
    expect(after.queued_uploads_count).toBe(1);
    expect(after.next_upload_attempt_at).toBeNull();

    userDatabaseManager.closeConnection(authId);
  });
});

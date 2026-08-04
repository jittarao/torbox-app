import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { createUploadTestEnv, cleanupUploadTestEnv } from './helpers/uploadTestHelper.js';

describe('syncUploadCountersForAllUsers pin safety', () => {
  let env;

  beforeEach(async () => {
    env = await createUploadTestEnv();
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    userDb.db
      .prepare(
        `
        INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
        VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:abc', 'queued', 'queued', 0)
      `
      )
      .run();
    env.userDatabaseManager.closeConnection(env.authId);
  });

  afterEach(() => {
    cleanupUploadTestEnv(env);
  });

  test('survives concurrent closeConnection during counter update', async () => {
    const { masterDatabase, userDatabaseManager, authId } = env;
    const originalUpdate = masterDatabase.updateUploadCounters.bind(masterDatabase);
    let concurrentCloseSawSkip = false;

    masterDatabase.updateUploadCounters = async (id, userDb) => {
      // Mimic upload-processor finally: close while sync still holds the handle.
      concurrentCloseSawSkip = userDatabaseManager.closeConnection(id) === false;
      await originalUpdate(id, userDb);
    };

    await masterDatabase.syncUploadCountersForAllUsers(userDatabaseManager);

    expect(concurrentCloseSawSkip).toBe(true);

    const after = masterDatabase.getQuery(
      'SELECT queued_uploads_count FROM user_registry WHERE auth_id = ?',
      [authId]
    );
    expect(after.queued_uploads_count).toBe(1);
  });
});

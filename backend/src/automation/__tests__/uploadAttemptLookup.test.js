import { describe, expect, test } from 'bun:test';
import { attachCreateWasCached } from '../uploadAttemptLookup.js';
import {
  createUploadTestEnv,
  cleanupUploadTestEnv,
} from '../../routes/__tests__/helpers/uploadTestHelper.js';

describe('uploadAttemptLookup', () => {
  test('attachCreateWasCached maps latest successful attempt per upload', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (id, type, upload_type, url, name, status, queue_order)
          VALUES
            (101, 'torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'cached', 'completed', 0),
            (102, 'torrent', 'magnet', 'magnet:?xt=urn:btih:b', 'uncached', 'completed', 1),
            (103, 'torrent', 'magnet', 'magnet:?xt=urn:btih:c', 'unknown', 'completed', 2)
        `
        )
        .run();

      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          VALUES
            (101, 'torrent', 200, 1, 1, datetime('now', '-10 minutes')),
            (102, 'torrent', 200, 1, 0, datetime('now', '-5 minutes'))
        `
        )
        .run();

      const uploads = [
        { id: 101, name: 'cached' },
        { id: 102, name: 'uncached' },
        { id: 103, name: 'unknown' },
      ];

      const enriched = attachCreateWasCached(userDb, uploads);
      expect(enriched[0].create_was_cached).toBe(true);
      expect(enriched[1].create_was_cached).toBe(false);
      expect(enriched[2].create_was_cached).toBeUndefined();
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });
});

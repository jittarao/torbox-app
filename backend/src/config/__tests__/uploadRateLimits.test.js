import { afterEach, describe, expect, test } from 'bun:test';

describe('uploadRateLimits', () => {
  const originalEnv = process.env.UPLOAD_UNCACHED_LIMIT_PER_HOUR;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.UPLOAD_UNCACHED_LIMIT_PER_HOUR;
    } else {
      process.env.UPLOAD_UNCACHED_LIMIT_PER_HOUR = originalEnv;
    }
  });

  test('defaults to 60 when env is unset', async () => {
    delete process.env.UPLOAD_UNCACHED_LIMIT_PER_HOUR;
    const mod = await import('../uploadRateLimits.js?t=' + Date.now());
    expect(mod.UPLOAD_UNCACHED_LIMIT_PER_HOUR).toBe(60);
    expect(mod.getUploadRateLimitConfig().uncachedPerHour).toBe(60);
  });

  test('falls back to 60 when env is non-numeric', async () => {
    process.env.UPLOAD_UNCACHED_LIMIT_PER_HOUR = 'not-a-number';
    const mod = await import('../uploadRateLimits.js?t=' + Date.now());
    expect(mod.UPLOAD_UNCACHED_LIMIT_PER_HOUR).toBe(60);
  });

  test('exports shared SQL hour window', async () => {
    const mod = await import('../uploadRateLimits.js');
    expect(mod.UPLOAD_UNCACHED_WINDOW_SQL).toBe("datetime('now', '-1 hour')");
  });

  test('getUncachedBudgetWaitMs uses oldest uncached attempt in rolling window', async () => {
    let env;
    try {
      const { createUploadTestEnv, cleanupUploadTestEnv } =
        await import('../../routes/__tests__/helpers/uploadTestHelper.js');
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
      const mod = await import('../uploadRateLimits.js');

      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          VALUES
            (1, 'torrent', 200, 1, 0, datetime('now', '-31 minutes')),
            (2, 'torrent', 200, 1, 0, datetime('now', '-5 minutes'))
        `
        )
        .run();

      for (let id = 3; id <= 60; id++) {
        userDb.db
          .prepare(
            `
            INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
            VALUES (?, 'torrent', 200, 1, 0, datetime('now', '-20 minutes'))
          `
          )
          .run(id);
      }

      const waitMs = mod.getUncachedBudgetWaitMs(userDb, 'torrent');
      expect(waitMs).toBeGreaterThan(25 * 60 * 1000);
      expect(waitMs).toBeLessThan(35 * 60 * 1000);
    } finally {
      if (env) {
        const { cleanupUploadTestEnv } =
          await import('../../routes/__tests__/helpers/uploadTestHelper.js');
        cleanupUploadTestEnv(env);
      }
    }
  });
});

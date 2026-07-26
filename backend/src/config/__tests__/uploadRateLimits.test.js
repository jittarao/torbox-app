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

  test('parseCachedCountsTowardHourlyLimit defaults true and accepts falsey values', async () => {
    const mod = await import('../uploadRateLimits.js');
    expect(mod.parseCachedCountsTowardHourlyLimit(undefined)).toBe(true);
    expect(mod.parseCachedCountsTowardHourlyLimit('')).toBe(true);
    expect(mod.parseCachedCountsTowardHourlyLimit('true')).toBe(true);
    expect(mod.parseCachedCountsTowardHourlyLimit('1')).toBe(true);
    expect(mod.parseCachedCountsTowardHourlyLimit('false')).toBe(false);
    expect(mod.parseCachedCountsTowardHourlyLimit('0')).toBe(false);
    expect(mod.parseCachedCountsTowardHourlyLimit('off')).toBe(false);
  });

  test('shouldConsumeHourlyCreateBudget respects the flag', async () => {
    const previous = process.env.UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT;
    const mod = await import('../uploadRateLimits.js');
    try {
      process.env.UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT = 'true';
      expect(mod.shouldConsumeHourlyCreateBudget(false)).toBe(true);
      expect(mod.shouldConsumeHourlyCreateBudget(true)).toBe(true);

      process.env.UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT = 'false';
      expect(mod.shouldConsumeHourlyCreateBudget(false)).toBe(true);
      expect(mod.shouldConsumeHourlyCreateBudget(true)).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT;
      } else {
        process.env.UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT = previous;
      }
    }
  });

  test('countUncachedUploadAttempts excludes cached when flag is false', async () => {
    let env;
    const previous = process.env.UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT;
    process.env.UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT = 'false';
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
            (1, 'torrent', 200, 1, 0, datetime('now', '-10 minutes')),
            (2, 'torrent', 200, 1, 1, datetime('now', '-5 minutes'))
        `
        )
        .run();

      expect(mod.countUncachedUploadAttempts(userDb, 'torrent')).toBe(1);
      expect(mod.getUploadRateLimitConfig().cachedCountsTowardLimit).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT;
      } else {
        process.env.UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT = previous;
      }
      if (env) {
        const { cleanupUploadTestEnv } =
          await import('../../routes/__tests__/helpers/uploadTestHelper.js');
        cleanupUploadTestEnv(env);
      }
    }
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

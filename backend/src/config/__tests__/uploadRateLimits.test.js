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
});

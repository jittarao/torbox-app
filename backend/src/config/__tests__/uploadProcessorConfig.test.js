import { afterEach, describe, expect, test } from 'bun:test';

describe('uploadProcessorConfig', () => {
  const original = {
    batch: process.env.UPLOAD_BATCH_FETCH_SIZE,
    work: process.env.UPLOAD_MAX_WORK_PER_DRAIN,
    timeout: process.env.CREATE_UPLOAD_TIMEOUT_MS,
  };

  afterEach(() => {
    for (const [key, val] of Object.entries(original)) {
      const envKey =
        key === 'batch'
          ? 'UPLOAD_BATCH_FETCH_SIZE'
          : key === 'work'
            ? 'UPLOAD_MAX_WORK_PER_DRAIN'
            : 'CREATE_UPLOAD_TIMEOUT_MS';
      if (val === undefined) {
        delete process.env[envKey];
      } else {
        process.env[envKey] = val;
      }
    }
  });

  test('defaults when env unset', async () => {
    delete process.env.UPLOAD_BATCH_FETCH_SIZE;
    delete process.env.UPLOAD_MAX_WORK_PER_DRAIN;
    delete process.env.CREATE_UPLOAD_TIMEOUT_MS;
    const mod = await import('../uploadProcessorConfig.js?t=' + Date.now());
    expect(mod.UPLOAD_BATCH_FETCH_SIZE).toBe(50);
    expect(mod.UPLOAD_MAX_WORK_PER_DRAIN).toBe(25);
    expect(mod.CREATE_UPLOAD_TIMEOUT_MS).toBe(30000);
  });

  test('falls back to defaults for non-positive values', async () => {
    process.env.UPLOAD_BATCH_FETCH_SIZE = '0';
    process.env.UPLOAD_MAX_WORK_PER_DRAIN = '-5';
    process.env.CREATE_UPLOAD_TIMEOUT_MS = 'abc';
    const mod = await import('../uploadProcessorConfig.js?t=' + Date.now());
    expect(mod.UPLOAD_BATCH_FETCH_SIZE).toBe(50);
    expect(mod.UPLOAD_MAX_WORK_PER_DRAIN).toBe(25);
    expect(mod.CREATE_UPLOAD_TIMEOUT_MS).toBe(30000);
  });
});

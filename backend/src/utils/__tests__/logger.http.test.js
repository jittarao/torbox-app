import { describe, expect, test } from 'bun:test';
import logger from '../logger.js';

function captureLogs(fn) {
  const original = {
    error: logger.logger.error.bind(logger.logger),
    warn: logger.logger.warn.bind(logger.logger),
    info: logger.logger.info.bind(logger.logger),
    debug: logger.logger.debug.bind(logger.logger),
  };
  const calls = { error: [], warn: [], info: [], debug: [] };
  logger.logger.error = (msg, meta) => calls.error.push({ msg, meta });
  logger.logger.warn = (msg, meta) => calls.warn.push({ msg, meta });
  logger.logger.info = (msg, meta) => calls.info.push({ msg, meta });
  logger.logger.debug = (msg, meta) => calls.debug.push({ msg, meta });
  try {
    fn();
  } finally {
    logger.logger.error = original.error;
    logger.logger.warn = original.warn;
    logger.logger.info = original.info;
    logger.logger.debug = original.debug;
  }
  return calls;
}

describe('logger.http', () => {
  test('redacts authId in the log message and url', () => {
    const authId = 'a'.repeat(64);
    const req = {
      method: 'GET',
      originalUrl: `/api/stremio/addons/1/stream?authId=${authId}&type=movie`,
      url: `/api/stremio/addons/1/stream?authId=${authId}&type=movie`,
      ip: '127.0.0.1',
      query: { authId },
      headers: {},
      get: () => 'node',
    };
    const res = { statusCode: 502 };

    const calls = captureLogs(() => logger.http(req, res, 12, 'abcd1234'));

    const entry = calls.debug[0] || calls.warn[0] || calls.error[0];
    expect(entry).toBeTruthy();
    expect(entry.msg).not.toContain(authId);
    expect(entry.msg).toContain('authId=[redacted]');
    expect(entry.meta.url).toContain('authId=[redacted]');
    expect(entry.meta.url).not.toContain(authId);
  });

  test('logs stremio upstream 502 as debug rather than error/warn', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/stremio/addons/1/stream?type=movie&mediaId=tt1',
      url: '/api/stremio/addons/1/stream?type=movie&mediaId=tt1',
      ip: '127.0.0.1',
      query: {},
      headers: {},
      get: () => 'node',
    };
    const res = { statusCode: 502 };

    const calls = captureLogs(() => logger.http(req, res, 10, 'abcd1234'));

    expect(calls.error).toHaveLength(0);
    expect(calls.warn).toHaveLength(0);
    expect(calls.debug).toHaveLength(1);
  });
});

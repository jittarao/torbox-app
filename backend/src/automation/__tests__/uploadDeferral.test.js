import { describe, expect, test } from 'bun:test';
import {
  getUploadDeferralStatistics,
  isTransientDeferralMessage,
  syncRateLimitDeferrals,
  syncAllRateLimitDeferrals,
  EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE,
  UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE,
  CONNECTION_DEFERRAL_MESSAGE,
  TRANSIENT_TORBOX_DEFERRAL_MESSAGE,
} from '../uploadDeferral.js';
import {
  createUploadTestEnv,
  cleanupUploadTestEnv,
} from '../../routes/__tests__/helpers/uploadTestHelper.js';
import { parseSqlUtcDate } from '../../config/uploadRateLimits.js';

describe('uploadDeferral', () => {
  test('isTransientDeferralMessage recognizes auto-retry deferral strings', () => {
    expect(
      isTransientDeferralMessage('Uncached rate limit reached. Will retry automatically.')
    ).toBe(true);
    expect(isTransientDeferralMessage('Rate limit reached. Will retry automatically.')).toBe(true);
    expect(isTransientDeferralMessage('File not found')).toBe(false);
    expect(isTransientDeferralMessage(null)).toBe(false);
  });

  test('getUploadDeferralStatistics reports queued items only while budget is exhausted', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          SELECT value, 'torrent', 200, 1, 0, datetime('now', '-30 minutes')
          FROM (SELECT 1 AS value UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
                UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
                UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
                UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
                UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
                UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
                UNION ALL SELECT 31 UNION ALL SELECT 32 UNION ALL SELECT 33 UNION ALL SELECT 34 UNION ALL SELECT 35
                UNION ALL SELECT 36 UNION ALL SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39 UNION ALL SELECT 40
                UNION ALL SELECT 41 UNION ALL SELECT 42 UNION ALL SELECT 43 UNION ALL SELECT 44 UNION ALL SELECT 45
                UNION ALL SELECT 46 UNION ALL SELECT 47 UNION ALL SELECT 48 UNION ALL SELECT 49 UNION ALL SELECT 50
                UNION ALL SELECT 51 UNION ALL SELECT 52 UNION ALL SELECT 53 UNION ALL SELECT 54 UNION ALL SELECT 55
                UNION ALL SELECT 56 UNION ALL SELECT 57 UNION ALL SELECT 58 UNION ALL SELECT 59 UNION ALL SELECT 60)
        `
        )
        .run();

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at)
          VALUES
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'queued-a', 'queued', 0, datetime('now', '+4 minutes')),
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:b', 'queued-b', 'queued', 1, datetime('now', '+4 minutes'))
        `
        )
        .run();

      const stats = getUploadDeferralStatistics(userDb);
      expect(stats.byType.torrent.deferredCount).toBe(2);
      expect(stats.byType.torrent.deferredUntil).not.toBeNull();

      const resumeMs = parseSqlUtcDate(stats.byType.torrent.deferredUntil).getTime() - Date.now();
      expect(resumeMs).toBeGreaterThan(25 * 60 * 1000);
      expect(resumeMs).toBeLessThan(35 * 60 * 1000);
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('getUploadDeferralStatistics hides deferrals when uncached budget has capacity', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          SELECT value, 'torrent', 200, 1, 0, datetime('now', '-30 minutes')
          FROM (SELECT 1 AS value UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
                UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
                UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
                UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
                UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
                UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
                UNION ALL SELECT 31 UNION ALL SELECT 32 UNION ALL SELECT 33 UNION ALL SELECT 34 UNION ALL SELECT 35
                UNION ALL SELECT 36 UNION ALL SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39 UNION ALL SELECT 40
                UNION ALL SELECT 41 UNION ALL SELECT 42 UNION ALL SELECT 43 UNION ALL SELECT 44 UNION ALL SELECT 45)
        `
        )
        .run();

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'stale-deferred', 'queued', 0, datetime('now', '+4 minutes'))
        `
        )
        .run();

      const stats = getUploadDeferralStatistics(userDb);
      expect(stats.byType.torrent.deferredCount).toBe(0);
      expect(stats.byType.torrent.deferredUntil).toBeNull();
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncRateLimitDeferrals clears stale budget deferrals when capacity returns', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'deferred-a', 'queued', 0, datetime('now', '+30 minutes'), ?),
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:b', 'deferred-b', 'queued', 1, datetime('now', '+45 minutes'), ?)
        `
        )
        .run(UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE, UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE);

      const result = syncRateLimitDeferrals(userDb, 'torrent');
      expect(result.released).toBe(2);
      expect(result.refreshed).toBe(0);

      const stillDeferred = userDb.db
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM uploads
          WHERE status = 'queued'
            AND next_attempt_at IS NOT NULL
            AND datetime(next_attempt_at) > datetime('now')
        `
        )
        .get();
      expect(stillDeferred.count).toBe(0);
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncRateLimitDeferrals keeps connection deferrals when budget has capacity', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'connection-paused', 'queued', 0, datetime('now', '+15 minutes'), ?)
        `
        )
        .run(CONNECTION_DEFERRAL_MESSAGE);

      const result = syncRateLimitDeferrals(userDb, 'torrent');
      expect(result.released).toBe(0);

      const row = userDb.db
        .prepare(
          `SELECT next_attempt_at, error_message FROM uploads WHERE name = 'connection-paused'`
        )
        .get();
      expect(row.next_attempt_at).not.toBeNull();
      expect(row.error_message).toBe(CONNECTION_DEFERRAL_MESSAGE);
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncRateLimitDeferrals keeps transient sibling deferrals when budget has capacity', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'transient-sibling', 'queued', 0, datetime('now', '+2 minutes'), ?)
        `
        )
        .run(TRANSIENT_TORBOX_DEFERRAL_MESSAGE);

      const result = syncRateLimitDeferrals(userDb, 'torrent');
      expect(result.released).toBe(0);

      const row = userDb.db
        .prepare(`SELECT next_attempt_at FROM uploads WHERE name = 'transient-sibling'`)
        .get();
      expect(row.next_attempt_at).not.toBeNull();
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncRateLimitDeferrals keeps short external TorBox 429 cool-downs when budget has capacity', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'external-429', 'queued', 0, datetime('now', '+1 minute'), ?)
        `
        )
        .run(EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE);

      const result = syncRateLimitDeferrals(userDb, 'torrent');
      expect(result.released).toBe(0);

      const row = userDb.db
        .prepare(`SELECT next_attempt_at FROM uploads WHERE name = 'external-429'`)
        .get();
      expect(row.next_attempt_at).not.toBeNull();
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncRateLimitDeferrals refreshes queued deferrals from current oldest uncached attempt', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      userDb.db
        .prepare(
          `
          INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
          SELECT value, 'torrent', 200, 1, 0, datetime('now', '-31 minutes')
          FROM (SELECT 1 AS value UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
                UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
                UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
                UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
                UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
                UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
                UNION ALL SELECT 31 UNION ALL SELECT 32 UNION ALL SELECT 33 UNION ALL SELECT 34 UNION ALL SELECT 35
                UNION ALL SELECT 36 UNION ALL SELECT 37 UNION ALL SELECT 38 UNION ALL SELECT 39 UNION ALL SELECT 40
                UNION ALL SELECT 41 UNION ALL SELECT 42 UNION ALL SELECT 43 UNION ALL SELECT 44 UNION ALL SELECT 45
                UNION ALL SELECT 46 UNION ALL SELECT 47 UNION ALL SELECT 48 UNION ALL SELECT 49 UNION ALL SELECT 50
                UNION ALL SELECT 51 UNION ALL SELECT 52 UNION ALL SELECT 53 UNION ALL SELECT 54 UNION ALL SELECT 55
                UNION ALL SELECT 56 UNION ALL SELECT 57 UNION ALL SELECT 58 UNION ALL SELECT 59 UNION ALL SELECT 60)
        `
        )
        .run();

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'queued', 'queued', 0, datetime('now', '+4 minutes'))
        `
        )
        .run();

      const result = syncRateLimitDeferrals(userDb, 'torrent');
      expect(result.released).toBe(0);
      expect(result.refreshed).toBe(1);

      const row = userDb.db
        .prepare(`SELECT next_attempt_at, error_message FROM uploads WHERE name = 'queued'`)
        .get();
      const resumeMs = parseSqlUtcDate(row.next_attempt_at).getTime() - Date.now();
      expect(resumeMs).toBeGreaterThan(25 * 60 * 1000);
      expect(resumeMs).toBeLessThan(35 * 60 * 1000);
      expect(row.error_message).toBe(UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE);
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('getUploadDeferralStatistics reports external 429 pause when budget has capacity', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'ext-a', 'queued', 0, datetime('now', '+5 minutes'), ?),
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:b', 'ext-b', 'queued', 1, datetime('now', '+5 minutes'), ?)
        `
        )
        .run(
          EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE,
          EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE
        );

      const stats = getUploadDeferralStatistics(userDb);
      expect(stats.byType.torrent.deferredCount).toBe(0);
      expect(stats.byType.torrent.pausedCount).toBe(2);
      expect(stats.byType.torrent.pausedUntil).not.toBeNull();
      expect(stats.byType.torrent.pauseReason).toBe('external_rate_limit');
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('getUploadDeferralStatistics reports connection pause when budget has capacity', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'conn-a', 'queued', 0, datetime('now', '+10 minutes'), ?)
        `
        )
        .run(CONNECTION_DEFERRAL_MESSAGE);

      const stats = getUploadDeferralStatistics(userDb);
      expect(stats.byType.torrent.pausedCount).toBe(1);
      expect(stats.byType.torrent.pauseReason).toBe('connection');
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncAllRateLimitDeferrals logs when rows are released or refreshed', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'deferred-a', 'queued', 0, datetime('now', '+30 minutes'), ?)
        `
        )
        .run(UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE);

      const result = syncAllRateLimitDeferrals(userDb);
      expect(result.released).toBe(1);
      expect(result.refreshed).toBe(0);
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });
});

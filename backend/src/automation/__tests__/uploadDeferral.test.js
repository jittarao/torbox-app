import { describe, expect, test } from 'bun:test';
import {
  getUploadDeferralStatistics,
  inferRateLimitStateFromQueue,
  getCreateQuotaWindowUsage,
  isTransientDeferralMessage,
  syncRateLimitDeferrals,
  syncAllRateLimitDeferrals,
  RATE_LIMIT_DEFERRAL_MESSAGE,
  CONNECTION_DEFERRAL_MESSAGE,
  TRANSIENT_TORBOX_DEFERRAL_MESSAGE,
  UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE,
  resumeAtSqlFromMs,
  TORBOX_UNCACHED_CREATE_LIMIT,
} from '../uploadDeferral.js';
import {
  createUploadTestEnv,
  cleanupUploadTestEnv,
} from '../../routes/__tests__/helpers/uploadTestHelper.js';
import { parseSqlUtcDate } from '../../config/torboxRateLimitHeaders.js';

describe('uploadDeferral', () => {
  test('isTransientDeferralMessage recognizes auto-retry deferral strings', () => {
    expect(isTransientDeferralMessage(RATE_LIMIT_DEFERRAL_MESSAGE)).toBe(true);
    expect(
      isTransientDeferralMessage('Uncached rate limit reached. Will retry automatically.')
    ).toBe(true);
    expect(isTransientDeferralMessage('File not found')).toBe(false);
    expect(isTransientDeferralMessage(null)).toBe(false);
  });

  test('getUploadDeferralStatistics reports queued items while TorBox quota is blocked', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'queued-a', 'queued', 0, datetime('now', '+4 minutes'), ?),
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:b', 'queued-b', 'queued', 1, datetime('now', '+4 minutes'), ?)
        `
        )
        .run(RATE_LIMIT_DEFERRAL_MESSAGE, RATE_LIMIT_DEFERRAL_MESSAGE);

      const resumeAtSql = resumeAtSqlFromMs(Date.now() + 30 * 60 * 1000);
      const stats = getUploadDeferralStatistics(userDb, {
        isBlocked: () => true,
        getResumeAtSql: () => resumeAtSql,
      });
      expect(stats.byType.torrent.deferredCount).toBe(2);
      expect(stats.byType.torrent.deferredUntil).not.toBeNull();
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('getUploadDeferralStatistics hides deferrals when quota is not blocked', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'stale-deferred', 'queued', 0, datetime('now', '+4 minutes'), ?)
        `
        )
        .run(RATE_LIMIT_DEFERRAL_MESSAGE);

      const stats = getUploadDeferralStatistics(userDb, { isBlocked: () => false });
      expect(stats.byType.torrent.deferredCount).toBe(1);
      expect(stats.byType.torrent.deferredUntil).not.toBeNull();
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncRateLimitDeferrals clears stale rate-limit deferrals when quota is known available', async () => {
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
        .run(RATE_LIMIT_DEFERRAL_MESSAGE, RATE_LIMIT_DEFERRAL_MESSAGE);

      const result = syncRateLimitDeferrals(userDb, 'torrent', {
        getAvailability: () => 'available',
      });
      expect(result.released).toBe(2);
      expect(result.refreshed).toBe(0);
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncRateLimitDeferrals preserves deferrals when quota availability is unknown', async () => {
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
        .run(RATE_LIMIT_DEFERRAL_MESSAGE);

      const result = syncRateLimitDeferrals(userDb, 'torrent', {
        getAvailability: () => 'unknown',
      });
      expect(result.released).toBe(0);
      expect(result.refreshed).toBe(0);

      const row = userDb.db
        .prepare(`SELECT next_attempt_at, error_message FROM uploads WHERE name = 'deferred-a'`)
        .get();
      expect(row.next_attempt_at).not.toBeNull();
      expect(row.error_message).toBe(RATE_LIMIT_DEFERRAL_MESSAGE);
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncRateLimitDeferrals does not overwrite connection pauses when blocked', async () => {
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

      const resumeAtSql = resumeAtSqlFromMs(Date.now() + 5 * 60 * 1000);
      const result = syncRateLimitDeferrals(userDb, 'torrent', {
        isBlocked: () => true,
        getResumeAtSql: () => resumeAtSql,
      });
      expect(result.refreshed).toBe(0);

      const row = userDb.db
        .prepare(
          `SELECT next_attempt_at, error_message FROM uploads WHERE name = 'connection-paused'`
        )
        .get();
      expect(row.error_message).toBe(CONNECTION_DEFERRAL_MESSAGE);
      const remainingMs = parseSqlUtcDate(row.next_attempt_at).getTime() - Date.now();
      expect(remainingMs).toBeGreaterThan(10 * 60 * 1000);
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncRateLimitDeferrals keeps connection deferrals when quota is not blocked', async () => {
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

      const result = syncRateLimitDeferrals(userDb, 'torrent', { isBlocked: () => false });
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

  test('syncRateLimitDeferrals keeps transient sibling deferrals when quota is not blocked', async () => {
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

      const result = syncRateLimitDeferrals(userDb, 'torrent', { isBlocked: () => false });
      expect(result.released).toBe(0);

      const row = userDb.db
        .prepare(`SELECT next_attempt_at FROM uploads WHERE name = 'transient-sibling'`)
        .get();
      expect(row.next_attempt_at).not.toBeNull();
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncRateLimitDeferrals refreshes queued deferrals from header resume time when blocked', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'queued', 'queued', 0, datetime('now', '+4 minutes'), ?)
        `
        )
        .run(RATE_LIMIT_DEFERRAL_MESSAGE);

      const resumeAtSql = resumeAtSqlFromMs(Date.now() + 30 * 60 * 1000);
      const result = syncRateLimitDeferrals(userDb, 'torrent', {
        isBlocked: () => true,
        getResumeAtSql: () => resumeAtSql,
      });
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

  test('getUploadDeferralStatistics reports rate-limit deferrals from queue rows', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      userDb.db
        .prepare(
          `
          INSERT INTO uploads (type, upload_type, url, name, status, queue_order, next_attempt_at, error_message)
          VALUES
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:a', 'rl-a', 'queued', 0, datetime('now', '+5 minutes'), ?),
            ('torrent', 'magnet', 'magnet:?xt=urn:btih:b', 'rl-b', 'queued', 1, datetime('now', '+5 minutes'), ?)
        `
        )
        .run(RATE_LIMIT_DEFERRAL_MESSAGE, RATE_LIMIT_DEFERRAL_MESSAGE);

      const stats = getUploadDeferralStatistics(userDb, { isBlocked: () => false });
      expect(stats.byType.torrent.deferredCount).toBe(2);
      expect(stats.byType.torrent.deferredUntil).not.toBeNull();
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('getUploadDeferralStatistics reports connection pause', async () => {
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

      const stats = getUploadDeferralStatistics(userDb, { isBlocked: () => false });
      expect(stats.byType.torrent.pausedCount).toBe(1);
      expect(stats.byType.torrent.pauseReason).toBe('connection');
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('syncAllRateLimitDeferrals releases stale deferrals when quota is not blocked', async () => {
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
        .run(RATE_LIMIT_DEFERRAL_MESSAGE);

      const result = syncAllRateLimitDeferrals(userDb, { getAvailability: () => 'available' });
      expect(result.released).toBe(1);
      expect(result.refreshed).toBe(0);
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('inferRateLimitStateFromQueue rebuilds blocked state from persisted deferrals', async () => {
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
        .run(RATE_LIMIT_DEFERRAL_MESSAGE);

      const state = inferRateLimitStateFromQueue(userDb, 'torrent');
      expect(state).not.toBeNull();
      expect(state.remaining).toBe(0);
      expect(state.resetAtMs).toBeGreaterThan(Date.now());
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('getCreateQuotaWindowUsage splits cached vs uncached and flags exhaustion', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      for (let i = 0; i < 3; i++) {
        const uploadId = userDb.db
          .prepare(
            `
            INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
            VALUES ('torrent', 'magnet', ?, ?, 'completed', ?)
          `
          )
          .run(`magnet:?xt=urn:btih:u${i}`, `uncached-${i}`, i).lastInsertRowid;
        userDb.db
          .prepare(
            `
            INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
            VALUES (?, 'torrent', 200, 1, 0, datetime('now', '-10 minutes'))
          `
          )
          .run(uploadId);
      }

      for (let i = 0; i < 2; i++) {
        const uploadId = userDb.db
          .prepare(
            `
            INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
            VALUES ('torrent', 'magnet', ?, ?, 'completed', ?)
          `
          )
          .run(`magnet:?xt=urn:btih:c${i}`, `cached-${i}`, 10 + i).lastInsertRowid;
        userDb.db
          .prepare(
            `
            INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
            VALUES (?, 'torrent', 200, 1, 1, datetime('now', '-5 minutes'))
          `
          )
          .run(uploadId);
      }

      const usage = getCreateQuotaWindowUsage(userDb, 'torrent');
      expect(usage.uncachedUsed).toBe(3);
      expect(usage.uncachedLimit).toBe(TORBOX_UNCACHED_CREATE_LIMIT);
      expect(usage.uncachedExhausted).toBe(false);
      expect(usage.uncachedResetAtMs).toBeGreaterThan(Date.now());
      expect(usage.totalUsed).toBeUndefined();
      expect(usage.totalLimit).toBeUndefined();
      expect(usage.totalResetAtMs).toBeUndefined();
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });

  test('getCreateQuotaWindowUsage marks uncachedExhausted at the uncached cap', async () => {
    let env;
    try {
      env = await createUploadTestEnv();
      const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);

      for (let i = 0; i < TORBOX_UNCACHED_CREATE_LIMIT; i++) {
        const uploadId = userDb.db
          .prepare(
            `
            INSERT INTO uploads (type, upload_type, url, name, status, queue_order)
            VALUES ('torrent', 'magnet', ?, ?, 'completed', ?)
          `
          )
          .run(`magnet:?xt=urn:btih:ex${i}`, `ex-${i}`, i).lastInsertRowid;
        userDb.db
          .prepare(
            `
            INSERT INTO upload_attempts (upload_id, type, status_code, success, is_cached, attempted_at)
            VALUES (?, 'torrent', 200, 1, 0, datetime('now', '-15 minutes'))
          `
          )
          .run(uploadId);
      }

      const usage = getCreateQuotaWindowUsage(userDb, 'torrent');
      expect(usage.uncachedUsed).toBe(TORBOX_UNCACHED_CREATE_LIMIT);
      expect(usage.uncachedExhausted).toBe(true);
    } finally {
      if (env) cleanupUploadTestEnv(env);
    }
  });
});

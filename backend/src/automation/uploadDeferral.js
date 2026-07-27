import { formatSqlUtcDate, parseSqlUtcDate } from '../config/torboxRateLimitHeaders.js';
import logger from '../utils/logger.js';

/** TorBox hourly create quota deferral (server-reported rate limit). */
export const RATE_LIMIT_DEFERRAL_MESSAGE = 'Rate limit reached. Will retry automatically.';

/** @deprecated Legacy message kept for clearing stale queue rows. */
export const UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE =
  'Uncached rate limit reached. Will retry automatically.';

/** @deprecated Legacy alias — use RATE_LIMIT_DEFERRAL_MESSAGE. */
export const EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE = RATE_LIMIT_DEFERRAL_MESSAGE;

/** TorBox unreachable — shared queue cool-down. */
export const CONNECTION_DEFERRAL_MESSAGE = 'TorBox API unavailable. Will retry automatically.';

/** Sibling pause while TorBox finishes a transient queued response. */
export const TRANSIENT_TORBOX_DEFERRAL_MESSAGE =
  'TorBox is still processing a queued upload. Will retry automatically.';

export const RATE_LIMIT_DEFERRAL_MESSAGES = [
  RATE_LIMIT_DEFERRAL_MESSAGE,
  UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE,
];

/** Messages for auto-retry deferrals; cleared on new deferrals for stale rows. */
export const TRANSIENT_DEFERRAL_MESSAGES = [
  ...RATE_LIMIT_DEFERRAL_MESSAGES,
  CONNECTION_DEFERRAL_MESSAGE,
  TRANSIENT_TORBOX_DEFERRAL_MESSAGE,
];

/** Tagged pauses surfaced in stats (connection/transient only — rate limits use deferred stats). */
export const QUEUE_PAUSE_DEFERRAL_MESSAGES = [
  CONNECTION_DEFERRAL_MESSAGE,
  TRANSIENT_TORBOX_DEFERRAL_MESSAGE,
];

const QUEUE_PAUSE_MSG_PLACEHOLDERS = QUEUE_PAUSE_DEFERRAL_MESSAGES.map(() => '?').join(', ');
const RATE_LIMIT_MSG_PLACEHOLDERS = RATE_LIMIT_DEFERRAL_MESSAGES.map(() => '?').join(', ');
const TRANSIENT_MSG_PLACEHOLDERS = TRANSIENT_DEFERRAL_MESSAGES.map(() => '?').join(', ');

const UPLOAD_TYPES = ['torrent', 'usenet', 'webdl'];

export function queuePauseMessageBindParams() {
  return [...QUEUE_PAUSE_DEFERRAL_MESSAGES];
}

export function rateLimitMessageBindParams() {
  return [...RATE_LIMIT_DEFERRAL_MESSAGES];
}

export function pauseReasonFromDeferralMessage(message) {
  if (RATE_LIMIT_DEFERRAL_MESSAGES.includes(message)) {
    return 'rate_limit';
  }
  if (message === CONNECTION_DEFERRAL_MESSAGE) {
    return 'connection';
  }
  if (message === TRANSIENT_TORBOX_DEFERRAL_MESSAGE) {
    return 'transient';
  }
  return null;
}

/** SQL expression: NULL out known transient deferral messages, keep others. */
export const CLEAR_TRANSIENT_ERROR_EXPR = `CASE WHEN error_message IN (${TRANSIENT_MSG_PLACEHOLDERS}) THEN NULL ELSE error_message END`;

export function transientMessageBindParams() {
  return [...TRANSIENT_DEFERRAL_MESSAGES];
}

export function isTransientDeferralMessage(message) {
  if (!message || typeof message !== 'string') return false;
  return TRANSIENT_DEFERRAL_MESSAGES.includes(message);
}

/**
 * Defer sibling queued uploads of the same type until nextAttemptAt.
 * @param {Object} userDb
 * @param {string} type
 * @param {number} excludeUploadId
 * @param {string} nextAttemptAt
 * @param {{ siblingErrorMessage?: string|null }} [options]
 * @returns {number}
 */
export function deferQueuedUploadSiblings(
  userDb,
  type,
  excludeUploadId,
  nextAttemptAt,
  { siblingErrorMessage = null } = {}
) {
  const setErrorExpr = siblingErrorMessage == null ? CLEAR_TRANSIENT_ERROR_EXPR : '?';
  const params =
    siblingErrorMessage == null
      ? [nextAttemptAt, ...transientMessageBindParams(), type, excludeUploadId]
      : [nextAttemptAt, siblingErrorMessage, type, excludeUploadId];

  const result = userDb.db
    .prepare(
      `
      UPDATE uploads
      SET next_attempt_at = ?,
          error_message = ${setErrorExpr},
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'queued'
        AND type = ?
        AND id != ?
    `
    )
    .run(...params);

  return result.changes;
}

function getRateLimitDeferredUntil(userDb, type) {
  const row = userDb.db
    .prepare(
      `
      SELECT MIN(next_attempt_at) AS deferred_until
      FROM uploads
      WHERE status = 'queued'
        AND type = ?
        AND next_attempt_at IS NOT NULL
        AND datetime(next_attempt_at) > datetime('now')
        AND error_message IN (${RATE_LIMIT_MSG_PLACEHOLDERS})
    `
    )
    .get(type, ...rateLimitMessageBindParams());
  return row?.deferred_until ?? null;
}

/**
 * Rehydrate blocked quota state from persisted queue deferrals after restart.
 * @param {Object} userDb
 * @param {string} type
 * @param {number} [nowMs]
 * @returns {import('../config/torboxRateLimitHeaders.js').RateLimitState|null}
 */
export function inferRateLimitStateFromQueue(userDb, type, nowMs = Date.now()) {
  const deferredUntil = getRateLimitDeferredUntil(userDb, type);
  if (!deferredUntil) {
    return null;
  }

  const resetAtMs = parseSqlUtcDate(deferredUntil).getTime();
  if (resetAtMs <= nowMs) {
    return null;
  }

  return {
    limit: null,
    remaining: 0,
    resetAtMs,
    observedAtMs: nowMs,
  };
}

/**
 * Keep queued upload deferrals aligned with cached TorBox rate-limit state.
 * @param {Object} userDb
 * @param {string} type
 * @param {{
 *   getAvailability?: (type: string) => import('../config/torboxRateLimitHeaders.js').RateLimitAvailability,
 *   isBlocked?: (type: string) => boolean,
 *   getResumeAtSql?: (type: string) => string|null
 * }} [rateLimit]
 * @returns {{ released: number, refreshed: number }}
 */
export function syncRateLimitDeferrals(userDb, type, rateLimit = {}) {
  const availability =
    rateLimit.getAvailability?.(type) ?? (rateLimit.isBlocked?.(type) ? 'blocked' : 'unknown');

  if (availability === 'available') {
    const released = userDb.db
      .prepare(
        `
        UPDATE uploads
        SET next_attempt_at = NULL,
            error_message = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE status = 'queued'
          AND type = ?
          AND next_attempt_at IS NOT NULL
          AND datetime(next_attempt_at) > datetime('now')
          AND error_message IN (${RATE_LIMIT_MSG_PLACEHOLDERS})
      `
      )
      .run(type, ...rateLimitMessageBindParams());
    return { released: released.changes, refreshed: 0 };
  }

  if (availability !== 'blocked') {
    return { released: 0, refreshed: 0 };
  }

  const nextAttemptAt = rateLimit.getResumeAtSql?.(type) ?? getRateLimitDeferredUntil(userDb, type);
  if (!nextAttemptAt) {
    return { released: 0, refreshed: 0 };
  }

  const refreshed = userDb.db
    .prepare(
      `
      UPDATE uploads
      SET next_attempt_at = ?,
          error_message = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'queued'
        AND type = ?
        AND (
          error_message IN (${RATE_LIMIT_MSG_PLACEHOLDERS})
          OR (
            next_attempt_at IS NULL
            AND error_message IS NULL
          )
        )
    `
    )
    .run(nextAttemptAt, RATE_LIMIT_DEFERRAL_MESSAGE, type, ...rateLimitMessageBindParams());

  return { released: 0, refreshed: refreshed.changes };
}

/**
 * Active non-rate-limit queue pause for a type (connection, transient).
 * @param {Object} userDb
 * @param {string} type
 */
function getQueuePauseStatistics(userDb, type) {
  const anchor = userDb.db
    .prepare(
      `
      SELECT error_message, MIN(next_attempt_at) AS paused_until
      FROM uploads
      WHERE status = 'queued'
        AND type = ?
        AND next_attempt_at IS NOT NULL
        AND datetime(next_attempt_at) > datetime('now')
        AND error_message IN (${QUEUE_PAUSE_MSG_PLACEHOLDERS})
      GROUP BY error_message
      ORDER BY paused_until ASC
      LIMIT 1
    `
    )
    .get(type, ...queuePauseMessageBindParams());

  if (!anchor?.paused_until) {
    return { pausedCount: 0, pausedUntil: null, pauseReason: null };
  }

  const queuedRow = userDb.db
    .prepare(
      `
      SELECT COUNT(*) AS paused_count
      FROM uploads
      WHERE status = 'queued'
        AND type = ?
    `
    )
    .get(type);

  return {
    pausedCount: queuedRow?.paused_count ?? 0,
    pausedUntil: anchor.paused_until,
    pauseReason: pauseReasonFromDeferralMessage(anchor.error_message),
  };
}

function countQueuedForType(userDb, type) {
  const row = userDb.db
    .prepare(
      `
      SELECT COUNT(*) AS deferred_count
      FROM uploads
      WHERE status = 'queued'
        AND type = ?
    `
    )
    .get(type);
  return row?.deferred_count ?? 0;
}

/**
 * Sync rate-limit deferrals for every upload type.
 * @param {Object} userDb
 * @param {{
 *   getAvailability?: (type: string) => import('../config/torboxRateLimitHeaders.js').RateLimitAvailability,
 *   isBlocked?: (type: string) => boolean,
 *   getResumeAtSql?: (type: string) => string|null
 * }} [rateLimit]
 */
export function syncAllRateLimitDeferrals(userDb, rateLimit = {}) {
  let released = 0;
  let refreshed = 0;
  for (const type of UPLOAD_TYPES) {
    const result = syncRateLimitDeferrals(userDb, type, rateLimit);
    released += result.released;
    refreshed += result.refreshed;
  }

  if (released > 0 || refreshed > 0) {
    logger.debug('Synced upload rate-limit deferrals', { released, refreshed });
  }

  return { released, refreshed };
}

/**
 * Per-type deferral stats for queued uploads.
 * @param {Object} userDb
 * @param {{
 *   getAvailability?: (type: string) => import('../config/torboxRateLimitHeaders.js').RateLimitAvailability,
 *   isBlocked?: (type: string) => boolean,
 *   getResumeAtSql?: (type: string) => string|null,
 *   getResetAtSql?: (type: string) => string|null
 * }} [rateLimit]
 */
export function getUploadDeferralStatistics(userDb, rateLimit = {}) {
  const emptyTypeStats = () => ({
    deferredCount: 0,
    deferredUntil: null,
    pausedCount: 0,
    pausedUntil: null,
    pauseReason: null,
  });

  const byType = {
    torrent: emptyTypeStats(),
    usenet: emptyTypeStats(),
    webdl: emptyTypeStats(),
  };

  let retryAt = null;
  for (const type of UPLOAD_TYPES) {
    const blocked = rateLimit.isBlocked?.(type) ?? false;
    const deferredCount = countQueuedForType(userDb, type);

    if (blocked && deferredCount > 0) {
      const deferredUntil =
        getRateLimitDeferredUntil(userDb, type) ??
        rateLimit.getResumeAtSql?.(type) ??
        rateLimit.getResetAtSql?.(type) ??
        null;
      byType[type] = { ...emptyTypeStats(), deferredCount, deferredUntil };
      if (deferredUntil && (!retryAt || deferredUntil < retryAt)) {
        retryAt = deferredUntil;
      }
      continue;
    }

    const rateLimitDeferredUntil = getRateLimitDeferredUntil(userDb, type);
    if (rateLimitDeferredUntil) {
      const rateLimitDeferredCount = userDb.db
        .prepare(
          `
          SELECT COUNT(*) AS deferred_count
          FROM uploads
          WHERE status = 'queued'
            AND type = ?
            AND next_attempt_at IS NOT NULL
            AND datetime(next_attempt_at) > datetime('now')
            AND error_message IN (${RATE_LIMIT_MSG_PLACEHOLDERS})
        `
        )
        .get(type, ...rateLimitMessageBindParams())?.deferred_count;

      if (rateLimitDeferredCount > 0) {
        byType[type] = {
          ...emptyTypeStats(),
          deferredCount: rateLimitDeferredCount,
          deferredUntil: rateLimitDeferredUntil,
        };
        if (!retryAt || rateLimitDeferredUntil < retryAt) {
          retryAt = rateLimitDeferredUntil;
        }
        continue;
      }
    }

    const pauseStats = getQueuePauseStatistics(userDb, type);
    if (pauseStats.pausedCount > 0) {
      byType[type] = { ...emptyTypeStats(), ...pauseStats };
      if (pauseStats.pausedUntil && (!retryAt || pauseStats.pausedUntil < retryAt)) {
        retryAt = pauseStats.pausedUntil;
      }
    }
  }

  return { byType, retryAt };
}

export function resumeAtSqlFromMs(resumeAtMs, nowMs = Date.now()) {
  if (resumeAtMs == null || resumeAtMs <= nowMs) {
    return null;
  }
  return formatSqlUtcDate(new Date(resumeAtMs));
}

import {
  getUncachedBudgetResumeAtSql,
  getUncachedBudgetWaitMs,
  isUncachedHourlyBudgetExhausted,
} from '../config/uploadRateLimits.js';
import logger from '../utils/logger.js';

/** Proactive local rolling-window deferral. */
export const UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE =
  'Uncached rate limit reached. Will retry automatically.';

/** TorBox returned 429 while local uncached budget still has capacity. */
export const EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE =
  'Rate limit reached. Will retry automatically.';

/** TorBox unreachable — shared queue cool-down. */
export const CONNECTION_DEFERRAL_MESSAGE = 'TorBox API unavailable. Will retry automatically.';

/** Sibling pause while TorBox finishes a transient queued response. */
export const TRANSIENT_TORBOX_DEFERRAL_MESSAGE =
  'TorBox is still processing a queued upload. Will retry automatically.';

/** Messages for auto-retry deferrals; cleared on new deferrals for stale rows. */
export const TRANSIENT_DEFERRAL_MESSAGES = [
  UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE,
  CONNECTION_DEFERRAL_MESSAGE,
  EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE,
  TRANSIENT_TORBOX_DEFERRAL_MESSAGE,
];

/** Tagged pauses surfaced in stats when local uncached budget still has headroom. */
export const QUEUE_PAUSE_DEFERRAL_MESSAGES = [
  EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE,
  CONNECTION_DEFERRAL_MESSAGE,
  TRANSIENT_TORBOX_DEFERRAL_MESSAGE,
];

const QUEUE_PAUSE_MSG_PLACEHOLDERS = QUEUE_PAUSE_DEFERRAL_MESSAGES.map(() => '?').join(', ');

export function queuePauseMessageBindParams() {
  return [...QUEUE_PAUSE_DEFERRAL_MESSAGES];
}

export function pauseReasonFromDeferralMessage(message) {
  if (message === EXTERNAL_TORBOX_RATE_LIMIT_DEFERRAL_MESSAGE) {
    return 'external_rate_limit';
  }
  if (message === CONNECTION_DEFERRAL_MESSAGE) {
    return 'connection';
  }
  if (message === TRANSIENT_TORBOX_DEFERRAL_MESSAGE) {
    return 'transient';
  }
  return null;
}

const TRANSIENT_MSG_PLACEHOLDERS = TRANSIENT_DEFERRAL_MESSAGES.map(() => '?').join(', ');

/** SQL expression: NULL out known transient deferral messages, keep others. */
export const CLEAR_TRANSIENT_ERROR_EXPR = `CASE WHEN error_message IN (${TRANSIENT_MSG_PLACEHOLDERS}) THEN NULL ELSE error_message END`;

const UPLOAD_TYPES = ['torrent', 'usenet', 'webdl'];

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

/**
 * Keep queued upload deferrals aligned with the rolling uncached budget.
 * - Budget available: clear stale future next_attempt_at so the queue can resume immediately.
 * - Budget exhausted: refresh next_attempt_at from the current oldest uncached attempt.
 * @param {Object} userDb
 * @param {string} type
 * @returns {{ released: number, refreshed: number }}
 */
export function syncRateLimitDeferrals(userDb, type) {
  const waitMs = getUncachedBudgetWaitMs(userDb, type);
  if (waitMs <= 0) {
    // Wake only rolling-window budget deferrals. External 429, connection, and transient
    // pauses keep their tagged error_message until next_attempt_at expires.
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
          AND error_message = ?
      `
      )
      .run(type, UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE);
    return { released: released.changes, refreshed: 0 };
  }

  const nextAttemptAt = getUncachedBudgetResumeAtSql(userDb, type);
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
          next_attempt_at IS NULL
          OR datetime(next_attempt_at) > datetime('now')
        )
    `
    )
    .run(nextAttemptAt, UNCACHED_RATE_LIMIT_DEFERRAL_MESSAGE, type);

  return { released: 0, refreshed: refreshed.changes };
}

/**
 * Active non-budget queue pause for a type (external 429, connection, transient).
 * @param {Object} userDb
 * @param {string} type
 * @returns {{ pausedCount: number, pausedUntil: string|null, pauseReason: string|null }}
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

/**
 * Sync rate-limit deferrals for every upload type.
 * @param {Object} userDb
 */
export function syncAllRateLimitDeferrals(userDb) {
  let released = 0;
  let refreshed = 0;
  for (const type of UPLOAD_TYPES) {
    const result = syncRateLimitDeferrals(userDb, type);
    released += result.released;
    refreshed += result.refreshed;
  }

  if (released > 0 || refreshed > 0) {
    logger.debug('Synced upload rate-limit deferrals', { released, refreshed });
  }

  return { released, refreshed };
}

/**
 * Per-type deferral stats for queued uploads blocked on the rolling uncached budget.
 * Resume time is derived from the oldest uncached attempt in the current window, not a
 * stored next_attempt_at snapshot from when the limit was first hit.
 * @param {Object} userDb
 * @returns {{ byType: Record<string, { deferredCount: number, deferredUntil: string|null, pausedCount: number, pausedUntil: string|null, pauseReason: string|null }>, retryAt: string|null }}
 */
export function getUploadDeferralStatistics(userDb) {
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
    if (isUncachedHourlyBudgetExhausted(userDb, type)) {
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

      const deferredCount = row?.deferred_count ?? 0;
      if (deferredCount > 0) {
        const deferredUntil = getUncachedBudgetResumeAtSql(userDb, type);
        byType[type] = { ...emptyTypeStats(), deferredCount, deferredUntil };
        if (deferredUntil && (!retryAt || deferredUntil < retryAt)) {
          retryAt = deferredUntil;
        }
      }
      continue;
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

/** Messages previously written for auto-retry deferrals; cleared on new deferrals for stale rows. */
export const TRANSIENT_DEFERRAL_MESSAGES = [
  'Uncached rate limit reached. Will retry automatically.',
  'TorBox API unavailable. Will retry automatically.',
  'Rate limit reached. Will retry automatically.',
];

const TRANSIENT_MSG_PLACEHOLDERS = TRANSIENT_DEFERRAL_MESSAGES.map(() => '?').join(', ');

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
 * Per-type deferral stats for queued uploads waiting on next_attempt_at.
 * @param {Object} userDb
 * @returns {{ byType: Record<string, { deferredCount: number, deferredUntil: string|null }>, retryAt: string|null }}
 */
export function getUploadDeferralStatistics(userDb) {
  const rows = userDb.db
    .prepare(
      `
      SELECT type,
             COUNT(*) AS deferred_count,
             MIN(next_attempt_at) AS deferred_until
      FROM uploads
      WHERE status = 'queued'
        AND next_attempt_at IS NOT NULL
        AND datetime(next_attempt_at) > datetime('now')
      GROUP BY type
    `
    )
    .all();

  const byType = {
    torrent: { deferredCount: 0, deferredUntil: null },
    usenet: { deferredCount: 0, deferredUntil: null },
    webdl: { deferredCount: 0, deferredUntil: null },
  };

  let retryAt = null;
  for (const row of rows) {
    if (row.type in byType) {
      byType[row.type] = {
        deferredCount: row.deferred_count,
        deferredUntil: row.deferred_until,
      };
      if (row.deferred_until && (!retryAt || row.deferred_until < retryAt)) {
        retryAt = row.deferred_until;
      }
    }
  }

  return { byType, retryAt };
}

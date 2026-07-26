/** Per-type TorBox uncached create limits (enforced in UploadProcessor). */

const DEFAULT_UNCACHED_LIMIT_PER_HOUR = 60;

const parsedUncachedLimit = parseInt(process.env.UPLOAD_UNCACHED_LIMIT_PER_HOUR || '', 10);

export const UPLOAD_UNCACHED_LIMIT_PER_HOUR = Number.isFinite(parsedUncachedLimit)
  ? parsedUncachedLimit
  : DEFAULT_UNCACHED_LIMIT_PER_HOUR;

/** Rolling 1-hour window for uncached attempt queries (SQLite UTC). */
export const UPLOAD_UNCACHED_WINDOW_SQL = "datetime('now', '-1 hour')";

export const UNCACHED_HOUR_MS = 60 * 60 * 1000;
export const UNCACHED_RESUME_BUFFER_MS = 1000;

const UPLOAD_TYPES = ['torrent', 'usenet', 'webdl'];

/** Rate limit metadata returned by GET /api/uploads for UI display. */
export function getUploadRateLimitConfig() {
  return {
    uncachedPerHour: UPLOAD_UNCACHED_LIMIT_PER_HOUR,
    perType: Object.fromEntries(UPLOAD_TYPES.map((type) => [type, UPLOAD_UNCACHED_LIMIT_PER_HOUR])),
  };
}

export function formatSqlUtcDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export function parseSqlUtcDate(sqlDate) {
  return new Date(sqlDate.replace(' ', 'T') + 'Z');
}

/**
 * Count uncached TorBox create attempts in the rolling hour window for a type.
 * @param {{ db: import('better-sqlite3').Database }} userDb
 * @param {string} type
 */
export function countUncachedUploadAttempts(userDb, type) {
  const result = userDb.db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM upload_attempts
      WHERE type = ? AND is_cached = 0 AND attempted_at >= ${UPLOAD_UNCACHED_WINDOW_SQL}
    `
    )
    .get(type);
  return result?.count || 0;
}

/**
 * Oldest uncached attempt timestamp still inside the rolling hour window.
 * @param {{ db: import('better-sqlite3').Database }} userDb
 * @param {string} type
 * @returns {string|null}
 */
export function getOldestUncachedUploadAttemptAt(userDb, type) {
  const result = userDb.db
    .prepare(
      `
      SELECT MIN(attempted_at) as oldest
      FROM upload_attempts
      WHERE type = ? AND is_cached = 0 AND attempted_at >= ${UPLOAD_UNCACHED_WINDOW_SQL}
    `
    )
    .get(type);
  return result?.oldest || null;
}

/**
 * Whether the per-type rolling uncached hourly budget is exhausted.
 * @param {{ db: import('better-sqlite3').Database }} userDb
 * @param {string} type
 */
export function isUncachedHourlyBudgetExhausted(userDb, type) {
  return countUncachedUploadAttempts(userDb, type) >= UPLOAD_UNCACHED_LIMIT_PER_HOUR;
}

/**
 * Milliseconds until the rolling uncached budget has capacity again.
 * @param {{ db: import('better-sqlite3').Database }} userDb
 * @param {string} type
 * @param {number} [nowMs]
 */
export function getUncachedBudgetWaitMs(userDb, type, nowMs = Date.now()) {
  const hourCount = countUncachedUploadAttempts(userDb, type);
  if (hourCount < UPLOAD_UNCACHED_LIMIT_PER_HOUR) {
    return 0;
  }

  const oldestHour = getOldestUncachedUploadAttemptAt(userDb, type);
  if (!oldestHour) {
    return UNCACHED_HOUR_MS;
  }

  const oldestDate = parseSqlUtcDate(oldestHour);
  const timeUntilOldestExpires = UNCACHED_HOUR_MS - (nowMs - oldestDate.getTime());
  return Math.max(0, timeUntilOldestExpires + UNCACHED_RESUME_BUFFER_MS);
}

/**
 * UTC SQL datetime when the rolling uncached budget has capacity again.
 * @param {{ db: import('better-sqlite3').Database }} userDb
 * @param {string} type
 * @param {number} [nowMs]
 * @returns {string|null}
 */
export function getUncachedBudgetResumeAtSql(userDb, type, nowMs = Date.now()) {
  const waitMs = getUncachedBudgetWaitMs(userDb, type, nowMs);
  if (waitMs <= 0) {
    return null;
  }
  return formatSqlUtcDate(new Date(nowMs + waitMs));
}

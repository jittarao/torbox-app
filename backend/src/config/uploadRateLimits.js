/**
 * Per-type TorBox create limits (enforced in UploadProcessor).
 *
 * TorBox documents a 60/hour cap for uncached creates only. Production has also
 * 429'd after Found Cached creates (local 53 uncached + 7 cached = 60). Toggle
 * `UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT` (default true) to match that TorBox
 * behavior, or set false to exclude cached creates if/when TorBox matches its docs.
 * DUPLICATE_ITEM resolves never consume budget. `is_cached` remains for UI badges.
 */

const DEFAULT_UNCACHED_LIMIT_PER_HOUR = 60;

const parsedUncachedLimit = parseInt(process.env.UPLOAD_UNCACHED_LIMIT_PER_HOUR || '', 10);

export const UPLOAD_UNCACHED_LIMIT_PER_HOUR = Number.isFinite(parsedUncachedLimit)
  ? parsedUncachedLimit
  : DEFAULT_UNCACHED_LIMIT_PER_HOUR;

/** Rolling 1-hour window for create-attempt budget queries (SQLite UTC). */
export const UPLOAD_UNCACHED_WINDOW_SQL = "datetime('now', '-1 hour')";

export const UNCACHED_HOUR_MS = 60 * 60 * 1000;
export const UNCACHED_RESUME_BUFFER_MS = 1000;

const UPLOAD_TYPES = ['torrent', 'usenet', 'webdl'];

/**
 * Parse UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT.
 * Default true (TorBox currently counts Found Cached toward the hourly pool).
 * Set false to exclude is_cached=1 attempts once TorBox matches its docs.
 * @param {string|undefined} [raw]
 * @returns {boolean}
 */
export function parseCachedCountsTowardHourlyLimit(
  raw = process.env.UPLOAD_CACHED_COUNTS_TOWARD_HOURLY_LIMIT
) {
  if (raw == null || String(raw).trim() === '') {
    return true;
  }
  const normalized = String(raw).trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  return true;
}

/** @returns {boolean} */
export function isCachedCountedTowardHourlyLimit() {
  return parseCachedCountsTowardHourlyLimit();
}

/**
 * SQL predicate for attempts that consume the hourly create budget.
 * Re-read on each call so tests can flip the env flag without reloading modules.
 * @returns {string}
 */
export function getUploadBudgetAttemptSql() {
  const base = `success = 1 AND (error_code IS NULL OR error_code != 'DUPLICATE_ITEM')`;
  if (isCachedCountedTowardHourlyLimit()) {
    return base;
  }
  return `${base} AND is_cached = 0`;
}

/**
 * Whether a successful create should decrement the in-memory drain budget.
 * @param {boolean} isCached
 * @returns {boolean}
 */
export function shouldConsumeHourlyCreateBudget(isCached) {
  return !isCached || isCachedCountedTowardHourlyLimit();
}

/** Rate limit metadata returned by GET /api/uploads for UI display. */
export function getUploadRateLimitConfig() {
  return {
    uncachedPerHour: UPLOAD_UNCACHED_LIMIT_PER_HOUR,
    perType: Object.fromEntries(UPLOAD_TYPES.map((type) => [type, UPLOAD_UNCACHED_LIMIT_PER_HOUR])),
    cachedCountsTowardLimit: isCachedCountedTowardHourlyLimit(),
  };
}

export function formatSqlUtcDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export function parseSqlUtcDate(sqlDate) {
  return new Date(sqlDate.replace(' ', 'T') + 'Z');
}

/**
 * Count TorBox create attempts that consume the rolling hourly budget for a type.
 * @param {{ db: import('better-sqlite3').Database }} userDb
 * @param {string} type
 */
export function countUncachedUploadAttempts(userDb, type) {
  const result = userDb.db
    .prepare(
      `
      SELECT COUNT(*) as count
      FROM upload_attempts
      WHERE type = ?
        AND ${getUploadBudgetAttemptSql()}
        AND attempted_at >= ${UPLOAD_UNCACHED_WINDOW_SQL}
    `
    )
    .get(type);
  return result?.count || 0;
}

/**
 * Oldest budget-consuming attempt timestamp still inside the rolling hour window.
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
      WHERE type = ?
        AND ${getUploadBudgetAttemptSql()}
        AND attempted_at >= ${UPLOAD_UNCACHED_WINDOW_SQL}
    `
    )
    .get(type);
  return result?.oldest || null;
}

/**
 * Whether the per-type rolling hourly create budget is exhausted.
 * @param {{ db: import('better-sqlite3').Database }} userDb
 * @param {string} type
 */
export function isUncachedHourlyBudgetExhausted(userDb, type) {
  return countUncachedUploadAttempts(userDb, type) >= UPLOAD_UNCACHED_LIMIT_PER_HOUR;
}

/**
 * Milliseconds until the rolling create budget has capacity again.
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
 * UTC SQL datetime when the rolling create budget has capacity again.
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

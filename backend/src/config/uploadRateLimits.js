/** Per-type TorBox uncached create limits (enforced in UploadProcessor). */

const DEFAULT_UNCACHED_LIMIT_PER_HOUR = 60;

const parsedUncachedLimit = parseInt(process.env.UPLOAD_UNCACHED_LIMIT_PER_HOUR || '', 10);

export const UPLOAD_UNCACHED_LIMIT_PER_HOUR = Number.isFinite(parsedUncachedLimit)
  ? parsedUncachedLimit
  : DEFAULT_UNCACHED_LIMIT_PER_HOUR;

/** Rolling 1-hour window for uncached attempt queries (SQLite UTC). */
export const UPLOAD_UNCACHED_WINDOW_SQL = "datetime('now', '-1 hour')";

const UPLOAD_TYPES = ['torrent', 'usenet', 'webdl'];

/** Rate limit metadata returned by GET /api/uploads for UI display. */
export function getUploadRateLimitConfig() {
  return {
    uncachedPerHour: UPLOAD_UNCACHED_LIMIT_PER_HOUR,
    perType: Object.fromEntries(UPLOAD_TYPES.map((type) => [type, UPLOAD_UNCACHED_LIMIT_PER_HOUR])),
  };
}

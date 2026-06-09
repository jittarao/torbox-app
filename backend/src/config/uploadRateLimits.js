/** Per-type TorBox upload attempt limits (enforced in UploadProcessor). */

export const UPLOAD_RATE_LIMIT_PER_MINUTE = 10;
export const UPLOAD_RATE_LIMIT_PER_HOUR = 60;

const UPLOAD_TYPES = ['torrent', 'usenet', 'webdl'];

/** Rate limit metadata returned by GET /api/uploads for UI display. */
export function getUploadRateLimitConfig() {
  return {
    perMinute: UPLOAD_RATE_LIMIT_PER_MINUTE,
    perHour: UPLOAD_RATE_LIMIT_PER_HOUR,
    perType: Object.fromEntries(
      UPLOAD_TYPES.map((type) => [type, UPLOAD_RATE_LIMIT_PER_HOUR])
    ),
  };
}

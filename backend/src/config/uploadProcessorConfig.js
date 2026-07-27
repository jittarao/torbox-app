/** Upload processor drain/batch tuning (enforced in UploadProcessor). */

function parsePositiveInt(envVal, defaultVal) {
  const parsed = parseInt(envVal || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultVal;
}

/** SQL rows per fetch into the in-memory per-type buffer — not the per-drain throughput cap. */
export const UPLOAD_BATCH_FETCH_SIZE = parsePositiveInt(process.env.UPLOAD_BATCH_FETCH_SIZE, 50);

/** Max uploads processed per drain invocation before yielding the worker — not the SQL fetch size. */
export const UPLOAD_MAX_WORK_PER_DRAIN = parsePositiveInt(
  process.env.UPLOAD_MAX_WORK_PER_DRAIN,
  25
);

/** TorBox create API request timeout (ms). */
export const CREATE_UPLOAD_TIMEOUT_MS = parsePositiveInt(
  process.env.CREATE_UPLOAD_TIMEOUT_MS,
  30000
);

/**
 * Fallback wait (ms) when TorBox blocks creates but response headers omit reset/retry timing.
 * Used for proactive gating, 429 deferral, and orphan block expiry (remaining=0 without reset).
 */
export const UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS = parsePositiveInt(
  process.env.UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS,
  5 * 60 * 1000
);

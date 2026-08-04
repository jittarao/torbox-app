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
 * Short per-upload cool-down after a single create timeout / connection blip.
 * Does not pause sibling queued uploads of the same type.
 */
export const UPLOAD_CONNECTION_SOFT_DEFER_MS = parsePositiveInt(
  process.env.UPLOAD_CONNECTION_SOFT_DEFER_MS,
  30 * 1000
);

/**
 * Consecutive create connection failures (per user+type) before pausing the whole type.
 * A single TorBox timeout must not mark the platform unavailable for 15 minutes.
 */
export const UPLOAD_CONNECTION_STRIKES_BEFORE_PAUSE = parsePositiveInt(
  process.env.UPLOAD_CONNECTION_STRIKES_BEFORE_PAUSE,
  3
);

/**
 * Consecutive create connection failures across any users (per upload type) before a
 * process-wide outage pause. Stops a TorBox 5xx storm from soft-deferring every user.
 */
export const UPLOAD_GLOBAL_CONNECTION_STRIKES_BEFORE_PAUSE = parsePositiveInt(
  process.env.UPLOAD_GLOBAL_CONNECTION_STRIKES_BEFORE_PAUSE,
  5
);

/** Type-wide pause after sustained TorBox unreachability (ms). */
export const UPLOAD_CONNECTION_DEFER_MS = parsePositiveInt(
  process.env.UPLOAD_CONNECTION_DEFER_MS,
  15 * 60 * 1000
);

/**
 * Max concurrent user DB opens during startup stuck-upload recovery.
 * Keeps recovery from flooding the LRU pool on large installs.
 */
export const UPLOAD_RECOVERY_CONCURRENCY = parsePositiveInt(
  process.env.UPLOAD_RECOVERY_CONCURRENCY,
  8
);

/**
 * Fallback wait (ms) when TorBox blocks creates but response headers omit reset/retry timing.
 * Used for proactive gating, 429 deferral, and orphan block expiry (remaining=0 without reset).
 */
export const UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS = parsePositiveInt(
  process.env.UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS,
  5 * 60 * 1000
);

/**
 * TorBox create API rate-limit headers (authoritative hourly quota).
 *
 * Headers observed on createtorrent / createusenet / createwebdownload responses:
 * - x-ratelimit-limit
 * - x-ratelimit-remaining
 * - x-ratelimit-reset
 * - retry-after (oldest-request expiry in rolling window; preferred for resume when blocking)
 */

import { UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS } from './uploadProcessorConfig.js';

const UPLOAD_TYPES = ['torrent', 'usenet', 'webdl'];

/** @typedef {{ limit: number|null, remaining: number|null, resetAtMs: number|null, observedAtMs: number }} RateLimitState */

/**
 * @param {Record<string, string>|import('axios').AxiosResponseHeaders|undefined|null} headers
 * @param {string} name
 */
function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }
  const lower = name.toLowerCase();
  if (headers[lower] != null) {
    return headers[lower];
  }
  if (headers[name] != null) {
    return headers[name];
  }
  return undefined;
}

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function parseNonNegativeInt(value) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Normalize x-ratelimit-reset to epoch milliseconds.
 * TorBox may send delta seconds or a unix timestamp.
 * @param {unknown} resetValue
 * @param {number} [nowMs]
 * @returns {number|null}
 */
export function normalizeResetAtMs(resetValue, nowMs = Date.now()) {
  const parsed = parseNonNegativeInt(resetValue);
  if (parsed == null) {
    return null;
  }
  // Values above ~Jan 2020 in seconds are treated as unix timestamps.
  if (parsed > 1_577_836_800) {
    return parsed * 1000;
  }
  return nowMs + parsed * 1000;
}

/**
 * Parse TorBox rate-limit headers from an axios/fetch response.
 * @param {Record<string, string>|import('axios').AxiosResponseHeaders|undefined|null} headers
 * @param {number} [nowMs]
 */
export function parseTorboxRateLimitHeaders(headers, nowMs = Date.now()) {
  const limitRaw = getHeader(headers, 'x-ratelimit-limit') ?? getHeader(headers, 'ratelimit-limit');
  const remainingRaw =
    getHeader(headers, 'x-ratelimit-remaining') ?? getHeader(headers, 'ratelimit-remaining');
  const resetRaw = getHeader(headers, 'x-ratelimit-reset') ?? getHeader(headers, 'ratelimit-reset');
  const retryAfterRaw = getHeader(headers, 'retry-after');

  const retryAfterSeconds = parseNonNegativeInt(retryAfterRaw);
  return {
    limit: parseNonNegativeInt(limitRaw),
    remaining: parseNonNegativeInt(remainingRaw),
    resetAtMs: normalizeResetAtMs(resetRaw, nowMs),
    retryAfterSeconds:
      retryAfterSeconds != null && retryAfterSeconds > 0 ? retryAfterSeconds : null,
  };
}

/** @param {number} [nowMs] @returns {RateLimitState} */
export function createEmptyRateLimitState(nowMs = Date.now()) {
  return {
    limit: null,
    remaining: null,
    resetAtMs: null,
    observedAtMs: nowMs,
  };
}

/**
 * Merge parsed headers into cached state and expire stale windows.
 * @param {RateLimitState} state
 * @param {ReturnType<typeof parseTorboxRateLimitHeaders>} parsed
 * @param {number} [nowMs]
 * @param {{ clearRemainingIfAbsent?: boolean }} [options]
 * @returns {RateLimitState}
 */
export function applyParsedHeaders(state, parsed, nowMs = Date.now(), options = {}) {
  const { clearRemainingIfAbsent = false } = options;
  const next = {
    ...state,
    observedAtMs: nowMs,
  };
  if (parsed.limit != null) {
    next.limit = parsed.limit;
  }
  if (parsed.remaining != null) {
    next.remaining = parsed.remaining;
  } else if (clearRemainingIfAbsent) {
    next.remaining = null;
  }
  if (parsed.resetAtMs != null) {
    next.resetAtMs = parsed.resetAtMs;
  }
  return normalizeExpiredRateLimitState(next, nowMs);
}

/**
 * Clear quota block after reset time elapses, or after block fallback when reset is unknown.
 * @param {RateLimitState} state
 * @param {number} [nowMs]
 * @param {number} [blockFallbackMs]
 * @returns {RateLimitState}
 */
export function normalizeExpiredRateLimitState(
  state,
  nowMs = Date.now(),
  blockFallbackMs = UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS
) {
  if (state.resetAtMs != null && nowMs >= state.resetAtMs) {
    return {
      ...state,
      remaining: null,
      resetAtMs: null,
    };
  }

  if (
    state.remaining === 0 &&
    state.resetAtMs == null &&
    blockFallbackMs > 0 &&
    nowMs >= state.observedAtMs + blockFallbackMs
  ) {
    return {
      ...state,
      remaining: null,
    };
  }

  return state;
}

/**
 * Whether proactive gating should block creates for this type.
 * @param {RateLimitState} state
 * @param {number} [nowMs]
 * @param {number} [blockFallbackMs]
 */
export function isRateLimitBlocked(
  state,
  nowMs = Date.now(),
  blockFallbackMs = UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS
) {
  const normalized = normalizeExpiredRateLimitState(state, nowMs, blockFallbackMs);
  if (normalized.remaining !== 0) {
    return false;
  }
  if (normalized.resetAtMs == null) {
    return true;
  }
  return nowMs < normalized.resetAtMs;
}

/** @typedef {'blocked'|'available'|'unknown'} RateLimitAvailability */

/**
 * Tri-state quota view for sync/release decisions.
 * Unknown must not release persisted queue deferrals (e.g. after process restart).
 * @param {RateLimitState} state
 * @param {number} [nowMs]
 * @param {number} [blockFallbackMs]
 * @returns {RateLimitAvailability}
 */
export function getRateLimitAvailability(
  state,
  nowMs = Date.now(),
  blockFallbackMs = UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS
) {
  const normalized = normalizeExpiredRateLimitState(state, nowMs, blockFallbackMs);
  if (normalized.remaining === 0) {
    return 'blocked';
  }
  if (normalized.remaining != null && normalized.remaining > 0) {
    return 'available';
  }
  return 'unknown';
}

/**
 * Resume timestamp when blocked. Uses earliest of retry-after and x-ratelimit-reset.
 * @param {RateLimitState} state
 * @param {{ retryAfterSeconds?: number|null }} [options]
 * @param {number} [nowMs]
 * @param {number} [blockFallbackMs]
 * @returns {number|null} epoch ms
 */
export function getRateLimitResumeAtMs(
  state,
  { retryAfterSeconds = null } = {},
  nowMs = Date.now(),
  blockFallbackMs = UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS
) {
  const normalized = normalizeExpiredRateLimitState(state, nowMs, blockFallbackMs);
  const blocking = normalized.remaining === 0;

  if (!blocking) {
    return null;
  }

  const candidates = [];
  if (retryAfterSeconds != null && retryAfterSeconds > 0) {
    candidates.push(nowMs + retryAfterSeconds * 1000);
  }
  if (normalized.resetAtMs != null && nowMs < normalized.resetAtMs) {
    candidates.push(normalized.resetAtMs);
  }

  if (candidates.length === 0) {
    return null;
  }

  return Math.min(...candidates);
}

/**
 * Milliseconds until the type can create again.
 * @param {RateLimitState} state
 * @param {{ retryAfterSeconds?: number|null }} [options]
 * @param {number} fallbackMs
 * @param {number} [nowMs]
 * @param {number} [blockFallbackMs]
 */
export function getRateLimitResumeWaitMs(
  state,
  { retryAfterSeconds = null } = {},
  fallbackMs,
  nowMs = Date.now(),
  blockFallbackMs = UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS
) {
  const resumeAtMs = getRateLimitResumeAtMs(state, { retryAfterSeconds }, nowMs, blockFallbackMs);
  if (resumeAtMs != null) {
    return Math.max(0, resumeAtMs - nowMs);
  }
  if (isRateLimitBlocked(state, nowMs, blockFallbackMs)) {
    return fallbackMs;
  }
  return 0;
}

export function formatSqlUtcDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export function parseSqlUtcDate(sqlDate) {
  return new Date(sqlDate.replace(' ', 'T') + 'Z');
}

/**
 * API/UI snapshot for one upload type.
 * @param {RateLimitState} state
 * @param {number} [nowMs]
 * @param {number} [blockFallbackMs]
 */
export function getRateLimitSnapshotForApi(
  state,
  nowMs = Date.now(),
  blockFallbackMs = UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS
) {
  const normalized = normalizeExpiredRateLimitState(state, nowMs, blockFallbackMs);
  const known = normalized.remaining != null || normalized.limit != null;
  const used =
    known && normalized.limit != null && normalized.remaining != null
      ? Math.max(0, normalized.limit - normalized.remaining)
      : null;

  return {
    limit: normalized.limit,
    remaining: normalized.remaining,
    used,
    resetAt: normalized.resetAtMs != null ? formatSqlUtcDate(new Date(normalized.resetAtMs)) : null,
    known,
  };
}

/** @returns {string[]} */
export function getUploadRateLimitTypes() {
  return [...UPLOAD_TYPES];
}

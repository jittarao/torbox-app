/**
 * TorBox create API rate-limit headers.
 *
 * TorBox returns two different x-ratelimit-* envelopes on create endpoints:
 * - Uncached creates: limit ≈ 60 (rolling hour) — authoritative for gating
 * - Cached creates: limit ≈ 300 (short window, ~per minute) — ignore for gating
 *
 * Headers observed on createtorrent / createusenet / createwebdownload responses:
 * - x-ratelimit-limit
 * - x-ratelimit-remaining
 * - x-ratelimit-reset
 * - retry-after (when present; preferred for resume when blocking)
 *
 * HTTP 429 for the uncached hourly cap often has no rate-limit headers; the body
 * is typically `{"detail":"60 per 1 hour"}`.
 */

import { UPLOAD_EXTERNAL_RATE_LIMIT_RETRY_MS } from './uploadProcessorConfig.js';

const UPLOAD_TYPES = ['torrent', 'usenet', 'webdl'];

/** TorBox rolling hourly uncached create budget (observed on createtorrent). */
export const TORBOX_UNCACHED_CREATE_LIMIT = 60;

/**
 * TorBox cached-create short-window limit (observed ~per minute).
 * Not used for hourly gating; retained for envelope classification / telemetry.
 */
export const TORBOX_CACHED_CREATE_LIMIT = 300;

/** TorBox rolling hourly uncached create window. */
export const TORBOX_CREATE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Midpoint between uncached (60) and cached (300) envelopes for classification. */
const UNCACHED_ENVELOPE_LIMIT_MAX = 120;

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
 * Parse a non-negative number (int or float string) then floor.
 * TorBox may send float unix timestamps like `1785453098.556586`.
 * @param {unknown} value
 * @returns {number|null}
 */
function parseNonNegativeNumber(value) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.floor(parsed);
}

/**
 * Normalize x-ratelimit-reset to epoch milliseconds.
 * TorBox may send delta seconds or a unix timestamp (possibly float).
 * @param {unknown} resetValue
 * @param {number} [nowMs]
 * @returns {number|null}
 */
export function normalizeResetAtMs(resetValue, nowMs = Date.now()) {
  const parsed = parseNonNegativeNumber(resetValue);
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

/**
 * Whether parsed headers look like the uncached hourly create budget (limit ≈ 60).
 * @param {{ limit?: number|null }} parsed
 */
export function isUncachedRateLimitEnvelope(parsed) {
  const limit = parsed?.limit;
  return limit != null && limit > 0 && limit <= UNCACHED_ENVELOPE_LIMIT_MAX;
}

/**
 * Whether parsed headers look like the cached short-window budget (limit ≈ 300).
 * @param {{ limit?: number|null }} parsed
 */
export function isCachedRateLimitEnvelope(parsed) {
  const limit = parsed?.limit;
  return limit != null && limit > UNCACHED_ENVELOPE_LIMIT_MAX;
}

/**
 * Detect TorBox uncached hourly 429 body (`{"detail":"60 per 1 hour"}`).
 * @param {unknown} detailOrBody
 */
export function isUncachedHourlyRateLimitDetail(detailOrBody) {
  let detail = detailOrBody;
  if (detail != null && typeof detail === 'object') {
    detail = detail.detail ?? detail.message ?? null;
  }
  if (detail == null) {
    return false;
  }
  return /\b60\s*per\s*1\s*hour\b/i.test(String(detail));
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
 * Merge parsed headers into uncached gating state and expire stale windows.
 * Callers must only pass uncached envelopes (limit ≈ 60).
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
 * Force uncached gating state to blocked (e.g. 429 with no headers).
 * @param {RateLimitState} state
 * @param {{ resetAtMs?: number|null, nowMs?: number }} [options]
 * @returns {RateLimitState}
 */
export function markUncachedRateLimitBlocked(state, { resetAtMs = null, nowMs = Date.now() } = {}) {
  return normalizeExpiredRateLimitState(
    {
      ...state,
      limit: state.limit ?? TORBOX_UNCACHED_CREATE_LIMIT,
      remaining: 0,
      resetAtMs: resetAtMs ?? state.resetAtMs,
      observedAtMs: nowMs,
    },
    nowMs
  );
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
 * Whether proactive gating should block creates for this type (uncached budget).
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
 * API/UI snapshot for one upload type (uncached gating state only).
 * Cached envelopes must not be stored in state; if a stale cached limit slipped
 * in, treat the snapshot as unknown so the UI does not show 300/min as quota.
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
  if (isCachedRateLimitEnvelope(normalized)) {
    return {
      limit: null,
      remaining: null,
      used: null,
      resetAt: null,
      known: false,
    };
  }

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

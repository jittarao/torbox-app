import { NextResponse } from 'next/server';

/** Headers emitted by express-rate-limit with `standardHeaders: true`. */
export const RATE_LIMIT_HEADER_NAMES = [
  'retry-after',
  'ratelimit-policy',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
];

/**
 * Extract rate-limit headers from a backend `fetch` Response.
 * @param {Response | null | undefined} response
 * @returns {Record<string, string>}
 */
export function extractRateLimitHeaders(response) {
  const headers = {};
  if (!response?.headers) {
    return headers;
  }

  for (const name of RATE_LIMIT_HEADER_NAMES) {
    const value = response.headers.get(name);
    if (value) {
      headers[name] = value;
    }
  }

  return headers;
}

function parseRetrySeconds(value) {
  const secs = parseInt(value, 10);
  return Number.isFinite(secs) && secs > 0 ? secs : null;
}

/**
 * Merge rate-limit headers from multiple backend responses.
 * Uses the largest retry delay when multiple sources provide one.
 * @param {...Record<string, string>} headerMaps
 * @returns {Record<string, string>}
 */
export function mergeRateLimitHeaders(...headerMaps) {
  const merged = {};
  let maxRetryAfter = null;
  let maxRateLimitReset = null;

  for (const map of headerMaps) {
    if (!map) continue;

    for (const [name, value] of Object.entries(map)) {
      const lower = name.toLowerCase();

      if (lower === 'retry-after') {
        const secs = parseRetrySeconds(value);
        if (secs != null) {
          maxRetryAfter = maxRetryAfter == null ? secs : Math.max(maxRetryAfter, secs);
        }
        continue;
      }

      if (lower === 'ratelimit-reset') {
        const secs = parseRetrySeconds(value);
        if (secs != null) {
          maxRateLimitReset = maxRateLimitReset == null ? secs : Math.max(maxRateLimitReset, secs);
        }
        continue;
      }

      if (RATE_LIMIT_HEADER_NAMES.includes(lower) && merged[lower] == null) {
        merged[lower] = value;
      }
    }
  }

  if (maxRetryAfter != null) {
    merged['retry-after'] = String(maxRetryAfter);
  }
  if (maxRateLimitReset != null) {
    merged['ratelimit-reset'] = String(maxRateLimitReset);
  }

  return merged;
}

/**
 * JSON response that preserves backend rate-limit headers for native clients.
 * @param {unknown} body
 * @param {{ status?: number, headers?: Record<string, string> }} [options]
 */
export function jsonWithRateLimitHeaders(body, { status = 200, headers = {} } = {}) {
  return NextResponse.json(body, { status, headers });
}

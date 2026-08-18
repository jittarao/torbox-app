import { NextResponse } from 'next/server';
import { isTorboxServerFault } from '@/config/errors';
import { extractPublicErrorCode, sanitizeError } from '@/utils/sanitizeError';

/** @type {Map<string, number>} */
const lastLoggedAt = new Map();
/** Unexpected / transient faults — keep short so real outages stay visible. */
const DEFAULT_RATE_MS = 60_000;
/**
 * Permanent / sticky client faults (plan, auth, unregistered). Match list-sync
 * non-retryable backoff so negative-cache polls do not log once a minute.
 */
const EXPECTED_RATE_MS = 15 * 60 * 1000;

/**
 * @param {string} key
 * @param {number} [rateMs]
 * @returns {boolean} true when this key was logged too recently
 */
function shouldRateLimit(key, rateMs = DEFAULT_RATE_MS) {
  const now = Date.now();
  const last = lastLoggedAt.get(key) || 0;
  if (now - last < rateMs) return true;
  lastLoggedAt.set(key, now);
  // Bound map size in long-lived Next.js processes
  if (lastLoggedAt.size > 500) {
    const cutoff = now - rateMs * 2;
    for (const [k, ts] of lastLoggedAt) {
      if (ts < cutoff) lastLoggedAt.delete(k);
    }
  }
  return false;
}

/**
 * @param {unknown} error
 */
function isTimeoutLikeError(error) {
  if (!error || typeof error !== 'object') return false;
  const name = error.name || '';
  if (name === 'TimeoutError' || name === 'AbortError' || name === 'TorboxTimeoutError') {
    return true;
  }
  const message = error.message || '';
  return (
    message.includes('Request timeout') ||
    message.includes('aborted due to timeout') ||
    message.includes('The operation was aborted')
  );
}

/**
 * True for expected client / upstream faults that should not dump stacks.
 * @param {unknown} error
 */
export function isExpectedApiError(error) {
  // Negative-cache rethrows — already logged when TorBox was actually contacted.
  if (error && typeof error === 'object' && error.listSyncCached) return true;

  const code = extractPublicErrorCode(error);
  if (
    code === 'PLAN_RESTRICTED_FEATURE' ||
    code === 'BAD_TOKEN' ||
    code === 'NO_AUTH' ||
    code === 'AUTH_ERROR' ||
    code === 'ITEM_NOT_FOUND' ||
    code === 'ENDPOINT_NOT_FOUND' ||
    code === 'UNKNOWN_ERROR'
  ) {
    return true;
  }

  if (isTimeoutLikeError(error)) return true;

  const message = error?.message || String(error || '');
  if (/Backend responded with status: (401|403|404)/.test(message)) return true;
  if (message === 'User not registered' || message.includes('API key inactive')) return true;
  if (message.includes('ECONNREFUSED') || message.includes('backend unreachable')) return true;
  if (message.includes('Unexpected token') && message.includes('JSON')) return true;
  if (/^API responded with status: 5\d\d$/.test(message)) return true;
  return false;
}

/**
 * Rate-limited route logging. Expected TorBox/backend faults → warn without stack.
 * @param {string} context
 * @param {unknown} error
 * @param {{ rateKey?: string, rateMs?: number }} [options]
 */
export function logRouteError(context, error, { rateKey, rateMs } = {}) {
  // Cached list-sync failures are rethrown on every client poll during backoff —
  // never log them again (the real upstream failure already logged once).
  if (error && typeof error === 'object' && error.listSyncCached) return;

  const code = extractPublicErrorCode(error);
  const message = error?.message || String(error || '');
  const summary = code || (isTimeoutLikeError(error) ? message || error.name : message);
  const key = rateKey || `${context}:${summary}`;
  const expected = isExpectedApiError(error) || (code && !isTorboxServerFault(code));
  const effectiveRate = rateMs ?? (expected ? EXPECTED_RATE_MS : DEFAULT_RATE_MS);

  if (expected) {
    if (shouldRateLimit(key, effectiveRate)) return;
    console.warn(`${context}: ${summary}`);
    return;
  }

  if (shouldRateLimit(key, effectiveRate)) {
    console.error(`${context}: ${summary}`);
    return;
  }
  // Always one line — TimeoutError/DOMException and TorBox payloads dump dozens of
  // fields when passed as the second console.error argument.
  console.error(`${context}: ${summary}`);
}

/**
 * Map a failed backend proxy response to a client NextResponse without stack spam.
 * Preserves 401/403/404 so unregistered users are not misreported as 500s.
 * @param {{ status?: number, data?: { error?: string, detail?: string } } | null | undefined} response
 * @param {string} context
 */
export function backendProxyErrorResponse(response, context) {
  const status = response?.status || 500;
  const error =
    response?.data?.error || response?.data?.detail || `Backend responded with status: ${status}`;

  if (status === 401 || status === 403 || status === 404) {
    const sharedKey =
      status === 404 && error === 'User not registered'
        ? 'backend:user-not-registered:404'
        : `${context}:${status}:${error}`;
    if (!shouldRateLimit(sharedKey, EXPECTED_RATE_MS)) {
      console.warn(`${context}: ${error} (${status})`);
    }
    return NextResponse.json({ success: false, error }, { status });
  }

  logRouteError(context, new Error(typeof error === 'string' ? error : `Backend status ${status}`));
  return NextResponse.json(
    { success: false, error: sanitizeError(new Error(String(error))) },
    { status: status >= 400 && status < 600 ? status : 500 }
  );
}

/** @internal */
export function resetRouteLogForTests() {
  lastLoggedAt.clear();
}

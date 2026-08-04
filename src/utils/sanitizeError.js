import {
  AIRLOCK_LIMIT_REACHED_ERROR,
  isKnownTorboxErrorCode,
  isTorboxServerFault,
  TORBOX_ERROR_CODES,
} from '@/config/errors';

/** Credential-related codes that map to HTTP 401 (client or verification). */
const AUTH_CLIENT_CODES = new Set([TORBOX_ERROR_CODES.NO_AUTH, TORBOX_ERROR_CODES.BAD_TOKEN]);

/**
 * Extract a known TorBox/public API error code from an Error, string, or TorBox-shaped object.
 * Accepts exact codes or `CODE: detail` messages.
 * @param {unknown} error
 * @returns {string | null}
 */
export function extractPublicErrorCode(error) {
  if (error && typeof error === 'object') {
    const fromFields = [error.error, error.code].find((v) => isKnownTorboxErrorCode(v));
    if (fromFields) return fromFields;
  }

  const message = error?.message || String(error || '');
  if (!message || message === '[object Object]') return null;

  if (isKnownTorboxErrorCode(message)) return message;

  const prefix = message.split(':')[0]?.trim();
  if (prefix && isKnownTorboxErrorCode(prefix)) return prefix;

  return null;
}

/**
 * Extract TorBox `detail` when present on the error object.
 * @param {unknown} error
 * @returns {string | null}
 */
export function extractPublicErrorDetail(error) {
  if (error && typeof error === 'object' && typeof error.detail === 'string' && error.detail) {
    return error.detail;
  }
  const message = error?.message || '';
  // `AUTH_ERROR: user facing detail`
  const match = /^([A-Z0-9_]+):\s*(.+)$/.exec(message);
  if (match && isKnownTorboxErrorCode(match[1])) {
    return match[2];
  }
  return null;
}

/**
 * HTTP status for a known public TorBox error code.
 * Server-fault codes (*_ERROR) → 503. Client faults → 4xx by category.
 * @param {string | null | undefined} code
 * @param {number} [fallback=500]
 */
export function httpStatusForPublicError(code, fallback = 500) {
  if (!code) return fallback;

  // TorBox: codes ending in ERROR are server faults (retryable / upstream).
  if (isTorboxServerFault(code)) {
    // AUTH_ERROR is a server-side verification fault per TorBox docs, not BAD_TOKEN.
    return 503;
  }

  if (AUTH_CLIENT_CODES.has(code)) return 401;
  if (
    code === TORBOX_ERROR_CODES.ITEM_NOT_FOUND ||
    code === TORBOX_ERROR_CODES.ENDPOINT_NOT_FOUND
  ) {
    return 404;
  }
  if (
    code === TORBOX_ERROR_CODES.PLAN_RESTRICTED_FEATURE ||
    code === AIRLOCK_LIMIT_REACHED_ERROR ||
    code === TORBOX_ERROR_CODES.VENDOR_DISABLED
  ) {
    return 403;
  }
  if (
    code === TORBOX_ERROR_CODES.MONTHLY_LIMIT ||
    code === TORBOX_ERROR_CODES.COOLDOWN_LIMIT ||
    code === TORBOX_ERROR_CODES.ACTIVE_LIMIT ||
    code === TORBOX_ERROR_CODES.TOO_MUCH_DATA
  ) {
    return 429;
  }
  if (
    code === TORBOX_ERROR_CODES.INVALID_OPTION ||
    code === TORBOX_ERROR_CODES.MISSING_REQUIRED_OPTION ||
    code === TORBOX_ERROR_CODES.TOO_MANY_OPTIONS ||
    code === TORBOX_ERROR_CODES.BOZO_TORRENT ||
    code === TORBOX_ERROR_CODES.BOZO_NZB ||
    code === TORBOX_ERROR_CODES.BOZO_RSS_FEED ||
    code === TORBOX_ERROR_CODES.BOZO_REGEX ||
    code === TORBOX_ERROR_CODES.BOZO_FILE ||
    code === TORBOX_ERROR_CODES.DIFF_ISSUE ||
    code === TORBOX_ERROR_CODES.BAD_CONFIRMATION ||
    code === TORBOX_ERROR_CODES.CONFIRMATION_EXPIRED
  ) {
    return 400;
  }

  // Remaining known client faults (DUPLICATE_ITEM, LINK_OFFLINE, DOWNLOAD_TOO_LARGE, …)
  if (isKnownTorboxErrorCode(code)) return 400;

  return fallback;
}

/**
 * Sanitize errors for API responses.
 * Known TorBox codes pass through in production so clients can branch on them;
 * everything else is redacted to avoid leaking internals.
 * @param {unknown} error
 */
export function sanitizeError(error) {
  const publicCode = extractPublicErrorCode(error);
  if (publicCode) return publicCode;

  const message = error?.message || String(error || '');
  if (process.env.NODE_ENV === 'production') {
    return 'Internal server error';
  }
  return message;
}

/**
 * Build a TorBox-shaped JSON error payload + HTTP status from a caught error.
 * Mirrors `{ success, error, detail }` so clients can use the same contract.
 * @param {unknown} error
 * @param {{ fallbackStatus?: number, includeSuccess?: boolean, detail?: string | null }} [options]
 */
export function publicApiErrorResponse(
  error,
  { fallbackStatus = 500, includeSuccess = true, detail: detailOverride } = {}
) {
  const code = extractPublicErrorCode(error);
  const errorMessage = code || sanitizeError(error);
  const status = code ? httpStatusForPublicError(code, fallbackStatus) : fallbackStatus;
  const detail = detailOverride !== undefined ? detailOverride : extractPublicErrorDetail(error);

  const body = includeSuccess
    ? { success: false, error: errorMessage, detail: detail ?? null }
    : { error: errorMessage, detail: detail ?? null };

  return { body, status, code };
}

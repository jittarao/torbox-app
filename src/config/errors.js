/**
 * TorBox API error codes and classification.
 * Docs: use `success` to decide outcome, `error` for the code, `detail` for the
 * user-facing message. Codes ending in "ERROR" are TorBox server faults;
 * all others are client/request faults.
 * @see https://api-docs.torbox.app (Errors Table)
 */

/** Full catalog of documented TorBox error codes (+ app-specific extras). */
export const TORBOX_ERROR_CODES = {
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NO_AUTH: 'NO_AUTH',
  BAD_TOKEN: 'BAD_TOKEN',
  AUTH_ERROR: 'AUTH_ERROR',
  INVALID_OPTION: 'INVALID_OPTION',
  REDIRECT_ERROR: 'REDIRECT_ERROR',
  OAUTH_VERIFICATION_ERROR: 'OAUTH_VERIFICATION_ERROR',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  PLAN_RESTRICTED_FEATURE: 'PLAN_RESTRICTED_FEATURE',
  DUPLICATE_ITEM: 'DUPLICATE_ITEM',
  BOZO_RSS_FEED: 'BOZO_RSS_FEED',
  TOO_MUCH_DATA: 'TOO_MUCH_DATA',
  DOWNLOAD_TOO_LARGE: 'DOWNLOAD_TOO_LARGE',
  MISSING_REQUIRED_OPTION: 'MISSING_REQUIRED_OPTION',
  TOO_MANY_OPTIONS: 'TOO_MANY_OPTIONS',
  BOZO_TORRENT: 'BOZO_TORRENT',
  NO_SERVERS_AVAILABLE_ERROR: 'NO_SERVERS_AVAILABLE_ERROR',
  MONTHLY_LIMIT: 'MONTHLY_LIMIT',
  COOLDOWN_LIMIT: 'COOLDOWN_LIMIT',
  ACTIVE_LIMIT: 'ACTIVE_LIMIT',
  DOWNLOAD_SERVER_ERROR: 'DOWNLOAD_SERVER_ERROR',
  BOZO_NZB: 'BOZO_NZB',
  SEARCH_ERROR: 'SEARCH_ERROR',
  INVALID_DEVICE: 'INVALID_DEVICE',
  DIFF_ISSUE: 'DIFF_ISSUE',
  LINK_OFFLINE: 'LINK_OFFLINE',
  VENDOR_DISABLED: 'VENDOR_DISABLED',
  BOZO_REGEX: 'BOZO_REGEX',
  BAD_CONFIRMATION: 'BAD_CONFIRMATION',
  CONFIRMATION_EXPIRED: 'CONFIRMATION_EXPIRED',
  BOZO_FILE: 'BOZO_FILE',
};

/**
 * TorBox reports the user's Airlock storage quota has been exceeded.
 * App-specific (not in TorBox's public errors table); client/request fault.
 */
export const AIRLOCK_LIMIT_REACHED_ERROR = 'AIRLOCK_LIMIT_REACHED';

const TORBOX_ERROR_CODE_SET = new Set(Object.values(TORBOX_ERROR_CODES));

/**
 * True when TorBox classifies the code as a server fault.
 * Rule: code ends with "ERROR".
 * @param {unknown} code
 */
export function isTorboxServerFault(code) {
  return typeof code === 'string' && code.endsWith('ERROR');
}

/**
 * True when the code is a known TorBox (or app) public error code.
 * @param {unknown} code
 */
export function isKnownTorboxErrorCode(code) {
  return (
    typeof code === 'string' &&
    (TORBOX_ERROR_CODE_SET.has(code) || code === AIRLOCK_LIMIT_REACHED_ERROR)
  );
}

/**
 * Client/request faults that should not be retried.
 * Derived from the TorBox catalog: everything that does NOT end in "ERROR",
 * plus Airlock quota (app-specific client fault).
 *
 * Kept as an object for callers that reference `NON_RETRYABLE_ERRORS.AUTH_ERROR`
 * historically — note AUTH_ERROR ends in ERROR (server fault) and is intentionally
 * absent here. Prefer BAD_TOKEN / NO_AUTH for permanent auth failures.
 */
export const NON_RETRYABLE_ERRORS = Object.fromEntries(
  Object.entries(TORBOX_ERROR_CODES).filter(([, code]) => !isTorboxServerFault(code))
);

NON_RETRYABLE_ERRORS[AIRLOCK_LIMIT_REACHED_ERROR] = AIRLOCK_LIMIT_REACHED_ERROR;

const NON_RETRYABLE_ERROR_STRINGS = Object.values(NON_RETRYABLE_ERRORS);

/**
 * True when a TorBox API response body is a permanent client/request failure.
 * Server-fault codes (*_ERROR) are retryable and return false.
 * @param {{ success?: boolean, error?: string, detail?: string } | null | undefined} data
 */
export function isNonRetryableResponse(data) {
  if (!data) return false;
  const error = data.error ?? '';
  if (!error) return false;

  // Prefer exact code match against TorBox's success/error contract.
  if (isTorboxServerFault(error)) return false;
  if (isKnownTorboxErrorCode(error)) return true;

  // Legacy: some callers embed the code in detail.
  const detail = data.detail ?? '';
  return NON_RETRYABLE_ERROR_STRINGS.some((err) => error.includes(err) || detail.includes(err));
}

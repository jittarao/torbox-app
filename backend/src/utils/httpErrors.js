/**
 * Sanitized JSON bodies for HTTP error responses (avoid leaking stack/internals in production).
 * Always includes an error code for programmatic error handling by clients.
 */

const GENERIC_500 = 'An unexpected error occurred';

/**
 * @param {unknown} err
 * @returns {{ success: false, error: string, code?: string, detail?: string }}
 */
export function serverErrorPayload(err) {
  const dev = process.env.NODE_ENV !== 'production';
  const isError = err instanceof Error;
  const msg = isError ? err.message : String(err);

  const payload = {
    success: false,
    error: dev ? msg : GENERIC_500,
  };

  // Include machine-readable error code when available (e.g. SQLITE_BUSY, VALIDATION_ERROR)
  if (isError && err.code) {
    payload.code = err.code;
  } else if (isError && /no such table/i.test(msg)) {
    // bun:sqlite often omits err.code; still expose a stable client-facing code
    payload.code = 'SQLITE_MISSING_TABLE';
  } else if (isError && err.errno != null) {
    payload.code = `SQLITE_ERRNO_${err.errno}`;
  }

  // Include detail when in dev or when error has a detail property
  if (dev && isError && err.detail) {
    payload.detail = err.detail;
  }

  return payload;
}

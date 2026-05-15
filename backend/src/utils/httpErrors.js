/**
 * Sanitized JSON bodies for HTTP error responses (avoid leaking stack/internals in production).
 */

const GENERIC_500 = 'An unexpected error occurred';

/**
 * @param {unknown} err
 * @returns {{ success: false, error: string }}
 */
export function serverErrorPayload(err) {
  const dev = process.env.NODE_ENV !== 'production';
  const msg = err instanceof Error ? err.message : String(err);
  return {
    success: false,
    error: dev ? msg : GENERIC_500,
  };
}

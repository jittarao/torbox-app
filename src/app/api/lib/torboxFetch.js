import { FETCH_TIMEOUT_MS } from '@/components/constants';

export const TORBOX_TIMEOUT_ERROR =
  'Request timeout - API took longer than 30 seconds to respond';

/**
 * fetch() to TorBox with an abort timeout (default {@link FETCH_TIMEOUT_MS}).
 * @param {string} url
 * @param {RequestInit & { timeout?: number }} [options]
 */
export async function torboxFetch(url, options = {}) {
  const { timeout = FETCH_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } catch (error) {
    if (isTorboxFetchTimeout(error)) {
      const timeoutError = new Error(TORBOX_TIMEOUT_ERROR);
      timeoutError.name = 'TorboxTimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isTorboxFetchTimeout(error) {
  return error?.name === 'AbortError' || error?.name === 'TorboxTimeoutError';
}

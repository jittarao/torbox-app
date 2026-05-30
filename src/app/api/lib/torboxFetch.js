import { FETCH_TIMEOUT_MS } from '@/components/constants';

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
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isTorboxFetchTimeout(error) {
  return error?.name === 'AbortError';
}

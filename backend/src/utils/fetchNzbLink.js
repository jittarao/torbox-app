/**
 * Download an NZB link through the SSRF-safe fetch helper and return the
 * final response. Callers name the bytes with `resolveUsenetUploadNames`.
 */

import { safeExternalFetch } from './safeExternalFetch.js';

const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 20000;

/**
 * @param {Buffer|Uint8Array|string} body
 * @param {string} [contentType]
 * @returns {boolean}
 */
export function looksLikeNzb(body, contentType) {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('text/html')) return false;
  const head = Buffer.isBuffer(body)
    ? body.subarray(0, 4000).toString('utf8')
    : String(body ?? '').slice(0, 4000);
  const trimmed = head.trimStart().toLowerCase();
  if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) return false;
  return trimmed.includes('<nzb');
}

/**
 * @param {string} url
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   lookup?: Function,
 *   maxBytes?: number,
 *   maxRedirects?: number,
 *   timeoutMs?: number,
 * }} [options]
 */
export async function fetchNzbLink(url, options = {}) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let result;
  try {
    result = await safeExternalFetch(url, {
      timeoutMs,
      maxBytes,
      maxRedirects,
      fetchImpl: options.fetchImpl,
      lookup: options.lookup,
      headers: {
        Accept: 'application/x-nzb, application/xml, text/xml, */*',
      },
    });
  } catch (error) {
    if (error?.code === 'INVALID_URL' || error?.code === 'SSRF_BLOCKED') {
      throw Object.assign(new Error(error.message || 'NZB link is not a valid URL'), {
        code: error.code,
        cause: error,
      });
    }
    if (error?.code === 'TOO_MANY_REDIRECTS') {
      throw Object.assign(new Error('Too many NZB redirects'), {
        code: error.code,
        cause: error,
      });
    }
    if (error?.code === 'PAYLOAD_TOO_LARGE') {
      throw Object.assign(new Error('NZB response is too large'), {
        code: error.code,
        cause: error,
      });
    }
    throw error;
  }

  if (!result.ok) {
    throw new Error(`NZB fetch failed with status ${result.status}`);
  }

  return {
    finalUrl: result.url,
    contentDisposition: result.headers?.['content-disposition'] || null,
    contentType: result.headers?.['content-type'] || null,
    body: Buffer.from(result.text ?? '', 'utf8'),
  };
}

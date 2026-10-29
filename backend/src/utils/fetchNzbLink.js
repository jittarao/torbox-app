/**
 * Download an NZB link, following a short redirect chain, and return the
 * final response. Callers name the bytes with `resolveUsenetUploadNames`.
 */

const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 20000;

function assertHttpUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('NZB link is not a valid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('NZB link must use http or https');
  }
  return parsed.href;
}

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
 * @param {{ fetchImpl?: typeof fetch, maxBytes?: number, maxRedirects?: number, timeoutMs?: number }} [options]
 */
export async function fetchNzbLink(url, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let current = assertHttpUrl(url);
  const seen = new Set();

  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    if (seen.has(current)) {
      throw new Error('NZB redirect loop');
    }
    seen.add(current);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'application/x-nzb, application/xml, text/xml, */*',
          'User-Agent': 'TorBoxManager',
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('NZB redirect missing location');
      }
      current = assertHttpUrl(new URL(location, current).href);
      continue;
    }

    if (!response.ok) {
      throw new Error(`NZB fetch failed with status ${response.status}`);
    }

    const advertised = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(advertised) && advertised > maxBytes) {
      throw new Error('NZB response is too large');
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > maxBytes) {
      throw new Error('NZB response is too large');
    }

    return {
      finalUrl: current,
      contentDisposition: response.headers.get('content-disposition'),
      contentType: response.headers.get('content-type'),
      body,
    };
  }

  throw new Error('Too many NZB redirects');
}

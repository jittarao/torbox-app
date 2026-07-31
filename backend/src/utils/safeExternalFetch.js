import dns from 'dns/promises';
import {
  validateExternalUrl,
  isPrivateOrReservedIp,
  stripIpv6Brackets,
  isIpLiteral,
} from './validateExternalUrl.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function userAgent() {
  const version = process.env.TORBOX_MANAGER_VERSION || '0.0.0';
  return `TorBoxManager/${version}`;
}

/**
 * Resolve hostname and reject if any address is private/reserved.
 * @param {string} hostname
 * @param {{ lookup?: typeof dns.lookup }} [deps]
 */
export async function assertHostnameResolvesPublic(hostname, deps = {}) {
  const lookup = deps.lookup || dns.lookup.bind(dns);
  const host = stripIpv6Brackets(String(hostname || '').toLowerCase());

  if (isPrivateOrReservedIp(host)) {
    throw Object.assign(new Error('Private or internal IP addresses are not allowed'), {
      code: 'SSRF_BLOCKED',
    });
  }

  // IP literals: no DNS needed (and bracketed forms break getaddrinfo).
  if (isIpLiteral(host)) {
    return [{ address: host, family: host.includes(':') ? 6 : 4 }];
  }

  let addresses;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch (error) {
    throw Object.assign(new Error(`DNS lookup failed: ${error.message}`), {
      code: 'DNS_FAILED',
      cause: error,
    });
  }

  if (!addresses?.length) {
    throw Object.assign(new Error('DNS lookup returned no addresses'), {
      code: 'DNS_FAILED',
    });
  }

  for (const entry of addresses) {
    if (isPrivateOrReservedIp(entry.address)) {
      throw Object.assign(new Error('Resolved to private or internal IP address'), {
        code: 'SSRF_BLOCKED',
      });
    }
  }

  return addresses;
}

async function validateAndResolve(urlString, deps) {
  const validation = validateExternalUrl(urlString);
  if (!validation.valid) {
    const reason = validation.reason || 'Invalid URL';
    const code = /private or internal|Blocked hostname/i.test(reason)
      ? 'SSRF_BLOCKED'
      : 'INVALID_URL';
    throw Object.assign(new Error(reason), { code });
  }
  const url = new URL(validation.url);
  await assertHostnameResolvesPublic(url.hostname, deps);
  return url;
}

async function readBodyLimited(response, maxBytes) {
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw Object.assign(new Error('Response body exceeds size limit'), {
        code: 'PAYLOAD_TOO_LARGE',
      });
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      throw Object.assign(new Error('Response body exceeds size limit'), {
        code: 'PAYLOAD_TOO_LARGE',
      });
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

/**
 * SSRF-safe HTTP(S) fetch with timeout, redirect re-validation, and body size limit.
 *
 * @returns {{ ok: boolean, status: number, url: string, text: string, json?: any }}
 */
export async function safeExternalFetch(
  inputUrl,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    headers = {},
    method = 'GET',
    lookup,
    fetchImpl,
  } = {}
) {
  const deps = { lookup };
  const doFetch = fetchImpl || fetch;
  let currentUrl = await validateAndResolve(inputUrl, deps);
  let redirects = 0;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    while (true) {
      let response;
      try {
        response = await doFetch(currentUrl.toString(), {
          method,
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': userAgent(),
            ...headers,
          },
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw Object.assign(new Error('Request timed out'), { code: 'TIMEOUT' });
        }
        throw Object.assign(new Error(error?.message || 'Network error'), {
          code: 'NETWORK_ERROR',
          cause: error,
        });
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw Object.assign(new Error('Redirect without Location header'), {
            code: 'BAD_REDIRECT',
          });
        }
        redirects += 1;
        if (redirects > MAX_REDIRECTS) {
          throw Object.assign(new Error('Too many redirects'), { code: 'TOO_MANY_REDIRECTS' });
        }
        const next = new URL(location, currentUrl);
        currentUrl = await validateAndResolve(next.toString(), deps);
        continue;
      }

      const text = await readBodyLimited(response, maxBytes);
      let json;
      let parseError = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (error) {
        parseError = error;
      }

      return {
        ok: response.ok,
        status: response.status,
        url: currentUrl.toString(),
        text,
        json,
        parseError,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}

export const SAFE_FETCH_DEFAULTS = {
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxBytes: DEFAULT_MAX_BYTES,
};

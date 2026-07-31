import { describe, expect, test } from 'bun:test';
import { safeExternalFetch, assertHostnameResolvesPublic } from '../safeExternalFetch.js';

function jsonResponse(status, body, headers = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? headers[name] ?? null,
    },
    body: null,
    text: async () => text,
  };
}

describe('assertHostnameResolvesPublic', () => {
  test('blocks IPv4-mapped loopback from DNS without fetching', async () => {
    const lookup = async () => [{ address: '::ffff:7f00:1', family: 6 }];
    await expect(
      assertHostnameResolvesPublic('evil.example.com', { lookup })
    ).rejects.toMatchObject({
      code: 'SSRF_BLOCKED',
    });
  });

  test('blocks dual-stack public A + mapped loopback AAAA', async () => {
    const lookup = async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '::ffff:7f00:1', family: 6 },
    ];
    await expect(
      assertHostnameResolvesPublic('evil.example.com', { lookup })
    ).rejects.toMatchObject({
      code: 'SSRF_BLOCKED',
    });
  });

  test('blocks bracketed IPv6 loopback literals', async () => {
    await expect(assertHostnameResolvesPublic('[::1]')).rejects.toMatchObject({
      code: 'SSRF_BLOCKED',
    });
  });

  test('allows public hostname when DNS is public', async () => {
    const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
    const addresses = await assertHostnameResolvesPublic('example.com', { lookup });
    expect(addresses).toHaveLength(1);
  });
});

describe('safeExternalFetch', () => {
  const prevAllowHttp = process.env.STREMIO_ALLOW_HTTP;

  test('fetches JSON when DNS and HTTP succeed', async () => {
    delete process.env.STREMIO_ALLOW_HTTP;
    const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
    const fetchImpl = async () => jsonResponse(200, { streams: [] });

    const result = await safeExternalFetch('https://addon.example.com/manifest.json', {
      lookup,
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(result.json).toEqual({ streams: [] });
  });

  test('rejects redirect to private IP', async () => {
    delete process.env.STREMIO_ALLOW_HTTP;
    const lookup = async (hostname) => {
      if (hostname === 'addon.example.com') return [{ address: '93.184.216.34', family: 4 }];
      throw new Error(`unexpected lookup ${hostname}`);
    };
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return jsonResponse(302, '', { location: 'https://127.0.0.1/secret' });
    };

    await expect(
      safeExternalFetch('https://addon.example.com/manifest.json', { lookup, fetchImpl })
    ).rejects.toMatchObject({ code: 'SSRF_BLOCKED' });
    expect(calls).toBe(1);
  });

  test('enforces redirect limit', async () => {
    delete process.env.STREMIO_ALLOW_HTTP;
    const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
    const fetchImpl = async (url) =>
      jsonResponse(302, '', { location: `https://addon.example.com/r${Math.random()}` });

    await expect(
      safeExternalFetch('https://addon.example.com/manifest.json', { lookup, fetchImpl })
    ).rejects.toMatchObject({ code: 'TOO_MANY_REDIRECTS' });
  });

  test('enforces body size limit', async () => {
    delete process.env.STREMIO_ALLOW_HTTP;
    const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
    const big = 'x'.repeat(100);
    const fetchImpl = async () => jsonResponse(200, big);

    await expect(
      safeExternalFetch('https://addon.example.com/manifest.json', {
        lookup,
        fetchImpl,
        maxBytes: 50,
      })
    ).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  test('times out when fetch aborts', async () => {
    delete process.env.STREMIO_ALLOW_HTTP;
    const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
    const fetchImpl = async (_url, opts) =>
      new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });

    await expect(
      safeExternalFetch('https://addon.example.com/manifest.json', {
        lookup,
        fetchImpl,
        timeoutMs: 20,
      })
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  test('blocks DNS-returned metadata mapped address before fetch', async () => {
    delete process.env.STREMIO_ALLOW_HTTP;
    const lookup = async () => [{ address: '::ffff:a9fe:a9fe', family: 6 }];
    let fetched = false;
    const fetchImpl = async () => {
      fetched = true;
      return jsonResponse(200, {});
    };

    await expect(
      safeExternalFetch('https://metadata.example.com/', { lookup, fetchImpl })
    ).rejects.toMatchObject({ code: 'SSRF_BLOCKED' });
    expect(fetched).toBe(false);
  });

  // restore env after suite
  test('cleanup env', () => {
    if (prevAllowHttp === undefined) delete process.env.STREMIO_ALLOW_HTTP;
    else process.env.STREMIO_ALLOW_HTTP = prevAllowHttp;
    expect(true).toBe(true);
  });
});

import { describe, expect, test } from 'bun:test';
import { fetchNzbLink, looksLikeNzb } from '../fetchNzbLink.js';

const NZB_BODY = '<?xml version="1.0" encoding="UTF-8"?>\n<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb"></nzb>';

function response(status, { headers = {}, body = '' } = {}) {
  return new Response(body, { status, headers });
}

describe('fetchNzbLink', () => {
  test('follows redirects and returns the final content-disposition', async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(String(url));
      if (String(url).includes('api.nzbgeek.info')) {
        return response(302, {
          headers: {
            location: 'https://cdn.example/files/Movie.Name.nzb',
            'content-disposition': 'attachment; filename="httpsapi.nzb"',
          },
        });
      }
      return response(200, {
        headers: {
          'content-type': 'application/x-nzb',
          'content-disposition': "attachment; filename*=UTF-8''Movie.Name.nzb",
        },
        body: NZB_BODY,
      });
    };

    const result = await fetchNzbLink(
      'https://api.nzbgeek.info/api?t=get&id=1&apikey=secret',
      { fetchImpl }
    );

    expect(seen).toHaveLength(2);
    expect(result.finalUrl).toBe('https://cdn.example/files/Movie.Name.nzb');
    expect(result.contentDisposition).toContain('Movie.Name.nzb');
    expect(result.contentDisposition).not.toContain('httpsapi');
    expect(looksLikeNzb(result.body, result.contentType)).toBe(true);
  });

  test('resolves a relative redirect against the current URL', async () => {
    const fetchImpl = async (url) => {
      if (String(url).endsWith('/api')) {
        return response(302, { headers: { location: '/files/Show.nzb' } });
      }
      return response(200, {
        headers: { 'content-type': 'application/x-nzb' },
        body: NZB_BODY,
      });
    };

    const result = await fetchNzbLink('https://indexer.example/api', { fetchImpl });
    expect(result.finalUrl).toBe('https://indexer.example/files/Show.nzb');
  });

  test('rejects a missing or invalid header body and non-http links', async () => {
    const fetchImpl = async () => response(200, { headers: { 'content-type': 'text/html' }, body: '<html></html>' });
    const html = await fetchNzbLink('https://indexer.example/get', { fetchImpl });
    expect(looksLikeNzb(html.body, html.contentType)).toBe(false);

    await expect(fetchNzbLink('file:///tmp/movie.nzb', { fetchImpl })).rejects.toThrow(/http/i);
  });

  test('stops after too many redirects', async () => {
    const fetchImpl = async (url) =>
      response(302, { headers: { location: `${url}-next` } });

    await expect(
      fetchNzbLink('https://indexer.example/start', { fetchImpl, maxRedirects: 2 })
    ).rejects.toThrow(/redirect/i);
  });
});

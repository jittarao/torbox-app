import { describe, expect, test, mock, beforeEach } from 'bun:test';

const fetchMock = mock(() => Promise.resolve({ ok: false, status: 404, json: null }));

mock.module('../safeExternalFetch.js', () => ({
  safeExternalFetch: (...args) => fetchMock(...args),
}));

const { findTmdbByImdbId, findTmdbByTmdbId } = await import('../tmdbClient.js');

function okJson(json) {
  return { ok: true, status: 200, json };
}

describe('tmdbClient find', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test('findTmdbByImdbId maps movie_results', async () => {
    fetchMock.mockImplementation(async (url) => {
      expect(String(url)).toContain('/find/tt0499549');
      expect(String(url)).toContain('external_source=imdb_id');
      return okJson({
        movie_results: [
          {
            id: 19995,
            title: 'Avatar',
            release_date: '2009-12-18',
            poster_path: '/a.jpg',
          },
        ],
        tv_results: [],
      });
    });

    const result = await findTmdbByImdbId('key', 'tt0499549', { allowTmdbFallback: false });
    expect(result).toEqual({
      tmdbId: 19995,
      mediaType: 'movie',
      title: 'Avatar',
      year: '2009',
      posterPath: '/a.jpg',
      imdbId: 'tt0499549',
      streamId: 'tt0499549',
    });
  });

  test('findTmdbByImdbId prefers movie over tv and returns null when empty', async () => {
    fetchMock.mockImplementation(async () =>
      okJson({
        movie_results: [],
        tv_results: [
          {
            id: 1399,
            name: 'Game of Thrones',
            first_air_date: '2011-04-17',
            poster_path: null,
          },
        ],
      })
    );
    const tv = await findTmdbByImdbId('key', 'tt0944947', { allowTmdbFallback: false });
    expect(tv.mediaType).toBe('tv');
    expect(tv.streamId).toBe('tt0944947');

    fetchMock.mockImplementation(async () => okJson({ movie_results: [], tv_results: [] }));
    expect(await findTmdbByImdbId('key', 'tt0000001')).toBe(null);
  });

  test('findTmdbByImdbId rejects invalid id', async () => {
    await expect(findTmdbByImdbId('key', 'not-an-id')).rejects.toMatchObject({
      code: 'TMDB_FIND_INVALID',
      status: 400,
    });
  });

  test('findTmdbByTmdbId loads movie detail + external ids', async () => {
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/movie/19995/external_ids')) {
        return okJson({ imdb_id: 'tt0499549' });
      }
      if (u.includes('/movie/19995')) {
        return okJson({
          id: 19995,
          title: 'Avatar',
          release_date: '2009-12-18',
          poster_path: '/a.jpg',
        });
      }
      return { ok: false, status: 404, json: null };
    });

    const result = await findTmdbByTmdbId('key', '19995', {
      mediaType: 'movie',
      allowTmdbFallback: false,
    });
    expect(result.streamId).toBe('tt0499549');
    expect(result.mediaType).toBe('movie');
    expect(result.title).toBe('Avatar');
  });

  test('findTmdbByTmdbId falls through to tv when movie missing', async () => {
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/movie/')) return { ok: false, status: 404, json: null };
      if (u.includes('/tv/1399/external_ids')) return okJson({ imdb_id: 'tt0944947' });
      if (u.includes('/tv/1399')) {
        return okJson({
          id: 1399,
          name: 'Game of Thrones',
          first_air_date: '2011-04-17',
          poster_path: null,
        });
      }
      return { ok: false, status: 404, json: null };
    });

    const result = await findTmdbByTmdbId('key', 1399, { allowTmdbFallback: false });
    expect(result.mediaType).toBe('tv');
    expect(result.streamId).toBe('tt0944947');
  });

  test('findTmdbByTmdbId throws TMDB_INVALID_KEY on 401', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 401, json: null }));
    await expect(findTmdbByTmdbId('bad-key', '19995')).rejects.toMatchObject({
      code: 'TMDB_INVALID_KEY',
      status: 401,
    });
  });
});

import { describe, expect, test } from 'bun:test';
import {
  normalizeImdbId,
  buildStreamId,
  mapSearchHit,
  mapTvSeasonSummary,
  mapTvSeasonEpisode,
  fetchTvSeason,
  isTmdbV4ReadToken,
  formatTmdbNetworkError,
} from '../tmdbClient.js';

describe('tmdbClient helpers', () => {
  test('isTmdbV4ReadToken detects JWT-shaped tokens', () => {
    expect(isTmdbV4ReadToken('eyJhbGciOiJIUzI1NiJ9.abc')).toBe(true);
    expect(isTmdbV4ReadToken('a1b2c3d4e5f6')).toBe(false);
  });

  test('formatTmdbNetworkError hides Bun fetch internals', () => {
    expect(
      formatTmdbNetworkError({
        code: 'NETWORK_ERROR',
        message:
          'The socket connection was closed unexpectedly. For more information, pass `verbose: true`',
      })
    ).toBe('Could not reach TMDB. Please try again in a moment.');
    expect(formatTmdbNetworkError({ code: 'TIMEOUT' })).toContain('timed out');
  });

  test('normalizeImdbId accepts tt ids only', () => {
    expect(normalizeImdbId('tt0111161')).toBe('tt0111161');
    expect(normalizeImdbId('TT0111161')).toBe('tt0111161');
    expect(normalizeImdbId('0111161')).toBe(null);
    expect(normalizeImdbId(null)).toBe(null);
  });

  test('buildStreamId prefers imdb then tmdb fallback', () => {
    expect(buildStreamId({ mediaType: 'movie', tmdbId: 550, imdbId: 'tt0137523' }, false)).toBe(
      'tt0137523'
    );
    expect(buildStreamId({ mediaType: 'movie', tmdbId: 550, imdbId: null }, true)).toBe('tmdb:550');
    expect(buildStreamId({ mediaType: 'movie', tmdbId: 550, imdbId: null }, false)).toBe(null);
  });

  test('mapSearchHit filters and maps movie/tv', () => {
    const movie = mapSearchHit(
      {
        id: 550,
        media_type: 'movie',
        title: 'Fight Club',
        release_date: '1999-10-15',
        poster_path: '/p.jpg',
      },
      'tt0137523',
      false
    );
    expect(movie).toEqual({
      tmdbId: 550,
      mediaType: 'movie',
      title: 'Fight Club',
      year: '1999',
      posterPath: '/p.jpg',
      imdbId: 'tt0137523',
      streamId: 'tt0137523',
    });

    const hidden = mapSearchHit(
      {
        id: 1,
        media_type: 'movie',
        title: 'No Imdb',
        release_date: '2020-01-01',
        poster_path: null,
      },
      null,
      false
    );
    expect(hidden).toBe(null);

    const fallback = mapSearchHit(
      {
        id: 1,
        media_type: 'tv',
        name: 'Show',
        first_air_date: '2011-04-17',
        poster_path: null,
      },
      null,
      true
    );
    expect(fallback.streamId).toBe('tmdb:1');
    expect(fallback.mediaType).toBe('tv');
    expect(fallback.year).toBe('2011');

    expect(mapSearchHit({ id: 1, media_type: 'person', name: 'X' }, null, true)).toBe(null);
  });

  test('mapTvSeasonSummary hides specials and maps poster/airDate', () => {
    expect(mapTvSeasonSummary(null)).toBe(null);
    expect(mapTvSeasonSummary({ season_number: 0, name: 'Specials', episode_count: 3 })).toBe(null);
    expect(
      mapTvSeasonSummary({
        season_number: 1,
        name: 'Season 1',
        episode_count: 10,
        poster_path: '/s1.jpg',
        air_date: '2011-04-17',
      })
    ).toEqual({
      seasonNumber: 1,
      name: 'Season 1',
      episodeCount: 10,
      posterPath: '/s1.jpg',
      airDate: '2011-04-17',
    });
    expect(mapTvSeasonSummary({ season_number: 2, episode_count: 'x' })).toEqual({
      seasonNumber: 2,
      name: 'Season 2',
      episodeCount: 0,
      posterPath: null,
      airDate: null,
    });
  });

  test('mapTvSeasonEpisode maps still/airDate and skips invalid', () => {
    expect(mapTvSeasonEpisode(null)).toBe(null);
    expect(mapTvSeasonEpisode({ episode_number: 0, name: 'Pilot' })).toBe(null);
    expect(
      mapTvSeasonEpisode({
        episode_number: 1,
        name: 'Winter Is Coming',
        still_path: '/e1.jpg',
        air_date: '2011-04-17',
      })
    ).toEqual({
      episodeNumber: 1,
      name: 'Winter Is Coming',
      stillPath: '/e1.jpg',
      airDate: '2011-04-17',
    });
    expect(mapTvSeasonEpisode({ episode_number: 2 })).toEqual({
      episodeNumber: 2,
      name: 'Episode 2',
      stillPath: null,
      airDate: null,
    });
  });

  test('fetchTvSeason rejects invalid season numbers without network', async () => {
    await expect(fetchTvSeason('key', 1399, 0)).rejects.toMatchObject({
      code: 'TMDB_SEASON_INVALID',
      status: 400,
    });
    await expect(fetchTvSeason('key', 1399, 'abc')).rejects.toMatchObject({
      code: 'TMDB_SEASON_INVALID',
      status: 400,
    });
    await expect(fetchTvSeason('key', 1399, -1)).rejects.toMatchObject({
      code: 'TMDB_SEASON_INVALID',
      status: 400,
    });
  });
});

import { describe, expect, test } from 'bun:test';
import {
  classifySearchQuery,
  buildEpisodeStreamId,
  enabledAddonsSupportTmdbPrefix,
  tmdbPosterUrl,
  tmdbStillUrl,
  yearFromAirDate,
  formatEpisodeCode,
  mediaTypeToStreamTypes,
  isEnrichableMediaId,
  isFullImdbId,
  suggestionToHistoryEntry,
  migrateSearchHistory,
  upsertSearchHistory,
  removeSearchHistoryEntry,
  historyEntryKey,
  parseFindQueryFromMediaId,
} from '../tmdbSearchQuery.js';

describe('tmdbSearchQuery', () => {
  test('classifySearchQuery', () => {
    expect(classifySearchQuery('')).toBe('empty');
    expect(classifySearchQuery('  ')).toBe('empty');
    expect(classifySearchQuery('tt0111161')).toBe('media_id');
    expect(classifySearchQuery('tt0944947:1:1')).toBe('media_id');
    expect(classifySearchQuery('anilist:16498')).toBe('media_id');
    expect(classifySearchQuery('tmdb:550')).toBe('media_id');
    expect(classifySearchQuery('Fight Club')).toBe('free_text');
    expect(classifySearchQuery('matrix')).toBe('free_text');
  });

  test('buildEpisodeStreamId', () => {
    expect(buildEpisodeStreamId('tt0944947', 1, 2)).toBe('tt0944947:1:2');
    expect(buildEpisodeStreamId('tmdb:1399', 2, 5)).toBe('tmdb:1399:2:5');
    expect(buildEpisodeStreamId('tt0944947', 0, 1)).toBe('tt0944947:0:1');
    expect(buildEpisodeStreamId('tt0944947', 1, 0)).toBe(null);
    expect(buildEpisodeStreamId('', 1, 1)).toBe(null);
  });

  test('enabledAddonsSupportTmdbPrefix', () => {
    expect(enabledAddonsSupportTmdbPrefix([])).toBe(false);
    expect(enabledAddonsSupportTmdbPrefix([{ enabled: true, id_prefixes: ['tt'] }])).toBe(false);
    expect(enabledAddonsSupportTmdbPrefix([{ enabled: false, id_prefixes: ['tmdb'] }])).toBe(false);
    expect(enabledAddonsSupportTmdbPrefix([{ enabled: true, id_prefixes: ['tt', 'tmdb'] }])).toBe(
      true
    );
  });

  test('tmdbPosterUrl', () => {
    expect(tmdbPosterUrl(null)).toBe(null);
    expect(tmdbPosterUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w92/abc.jpg');
    expect(tmdbPosterUrl('https://cdn.example/p.jpg')).toBe('https://cdn.example/p.jpg');
  });

  test('tmdbStillUrl', () => {
    expect(tmdbStillUrl(null)).toBe(null);
    expect(tmdbStillUrl('/still.jpg')).toBe('https://image.tmdb.org/t/p/w185/still.jpg');
    expect(tmdbStillUrl('https://cdn.example/s.jpg')).toBe('https://cdn.example/s.jpg');
  });

  test('yearFromAirDate', () => {
    expect(yearFromAirDate(null)).toBe(null);
    expect(yearFromAirDate('2011-04-17')).toBe('2011');
    expect(yearFromAirDate('not-a-date')).toBe(null);
  });

  test('formatEpisodeCode', () => {
    expect(formatEpisodeCode(1, 2)).toBe('S01E02');
    expect(formatEpisodeCode(10, 11)).toBe('S10E11');
  });

  test('mediaTypeToStreamTypes', () => {
    expect(mediaTypeToStreamTypes('movie')).toEqual(['movie']);
    expect(mediaTypeToStreamTypes('tv')).toEqual(['series']);
    expect(mediaTypeToStreamTypes('other')).toEqual(null);
  });

  test('isEnrichableMediaId', () => {
    expect(isEnrichableMediaId('tt0499549')).toBe(true);
    // Bare tmdb: ids are not enrichable (movie/TV id namespaces collide)
    expect(isEnrichableMediaId('tmdb:19995')).toBe(false);
    expect(isEnrichableMediaId('tt0944947:1:1')).toBe(false);
    expect(isEnrichableMediaId('tmdb:1399:1:1')).toBe(false);
    expect(isEnrichableMediaId('anilist:1')).toBe(false);
  });

  test('isFullImdbId', () => {
    expect(isFullImdbId('tt11126994')).toBe(true);
    expect(isFullImdbId('tt0111161')).toBe(true);
    expect(isFullImdbId('TT0499549')).toBe(true);
    expect(isFullImdbId('tt111')).toBe(false);
    expect(isFullImdbId('tt')).toBe(false);
    expect(isFullImdbId('tt0944947:1:1')).toBe(false);
    expect(isFullImdbId('tmdb:19995')).toBe(false);
    expect(isFullImdbId('')).toBe(false);
    expect(isFullImdbId('  tt0111161  ')).toBe(true);
  });

  test('migrateSearchHistory converts v1 strings', () => {
    expect(migrateSearchHistory(['tt1', 'tt2'])).toEqual([
      { kind: 'media_id', streamId: 'tt1' },
      { kind: 'media_id', streamId: 'tt2' },
    ]);
  });

  test('upsertSearchHistory dedupes by streamId and caps at 10', () => {
    const a = suggestionToHistoryEntry({
      tmdbId: 1,
      mediaType: 'movie',
      title: 'A',
      year: '2009',
      posterPath: null,
      imdbId: 'tt1',
      streamId: 'tt1',
    });
    const next = upsertSearchHistory([{ kind: 'media_id', streamId: 'tt1' }], a);
    expect(next[0]).toMatchObject({ kind: 'tmdb', streamId: 'tt1', title: 'A' });
    expect(next).toHaveLength(1);
  });

  test('removeSearchHistoryEntry removes by streamId and tmdb key', () => {
    const history = [
      { kind: 'media_id', streamId: 'tt1' },
      {
        kind: 'tmdb',
        tmdbId: 2,
        mediaType: 'movie',
        title: 'B',
        year: null,
        posterPath: null,
        imdbId: null,
        streamId: 'tt2',
      },
      { kind: 'media_id', streamId: 'tt3' },
    ];
    expect(removeSearchHistoryEntry(history, { kind: 'media_id', streamId: 'tt1' })).toEqual([
      history[1],
      history[2],
    ]);
    expect(
      removeSearchHistoryEntry(history, {
        kind: 'tmdb',
        tmdbId: 2,
        mediaType: 'movie',
        streamId: 'tt2',
      })
    ).toEqual([history[0], history[2]]);
  });

  test('historyEntryKey and parseFindQueryFromMediaId', () => {
    expect(historyEntryKey({ kind: 'tmdb', tmdbId: 1, mediaType: 'movie', streamId: 'tt1' })).toBe(
      'tmdb:movie:1'
    );
    expect(historyEntryKey({ kind: 'media_id', streamId: 'tt1' })).toBe('id:tt1');
    expect(parseFindQueryFromMediaId('tt0499549')).toEqual({ imdbId: 'tt0499549' });
    expect(parseFindQueryFromMediaId('tmdb:19995')).toEqual({ tmdbId: '19995' });
    expect(parseFindQueryFromMediaId('tt1:1:1')).toBe(null);
  });
});

import { describe, expect, test } from 'bun:test';
import {
  parseDownloadSearchQuery,
  itemMatchesDownloadSearch,
  getFilesVisibleForDownloadSearch,
  itemHasFileNameSearchMatch,
} from '../downloadSearch.js';

describe('parseDownloadSearchQuery', () => {
  test('empty query', () => {
    expect(parseDownloadSearchQuery('')).toEqual({ include: [], exclude: [] });
  });

  test('single unquoted word', () => {
    expect(parseDownloadSearchQuery('foo')).toEqual({
      include: [{ type: 'or', words: ['foo'] }],
      exclude: [],
    });
  });

  test('unquoted words form OR group', () => {
    expect(parseDownloadSearchQuery('foo bar')).toEqual({
      include: [{ type: 'or', words: ['foo', 'bar'] }],
      exclude: [],
    });
  });

  test('quoted phrase', () => {
    expect(parseDownloadSearchQuery('"foo bar"')).toEqual({
      include: [{ type: 'phrase', value: 'foo bar' }],
      exclude: [],
    });
  });

  test('phrase AND OR group', () => {
    expect(parseDownloadSearchQuery('"season 1" 1080p bluray')).toEqual({
      include: [
        { type: 'phrase', value: 'season 1' },
        { type: 'or', words: ['1080p', 'bluray'] },
      ],
      exclude: [],
    });
  });

  test('exclude term', () => {
    expect(parseDownloadSearchQuery('movie -sample')).toEqual({
      include: [{ type: 'or', words: ['movie'] }],
      exclude: [{ type: 'or', words: ['sample'] }],
    });
  });

  test('exclude quoted phrase', () => {
    expect(parseDownloadSearchQuery('-"sample clip"')).toEqual({
      include: [],
      exclude: [{ type: 'phrase', value: 'sample clip' }],
    });
  });
});

describe('itemMatchesDownloadSearch', () => {
  const item = {
    name: 'The Matrix 1999 1080p',
    files: [{ name: 'matrix.mkv', short_name: 'matrix.mkv' }],
  };

  test('OR matches any word in title', () => {
    expect(itemMatchesDownloadSearch(item, 'bluray 720p')).toBe(false);
    expect(itemMatchesDownloadSearch(item, '1080p 720p')).toBe(true);
  });

  test('quoted phrase requires exact substring', () => {
    expect(itemMatchesDownloadSearch(item, '"matrix 1999"')).toBe(true);
    expect(itemMatchesDownloadSearch(item, '"1999 1080"')).toBe(true);
    expect(itemMatchesDownloadSearch(item, '"matrix 720"')).toBe(false);
  });

  test('exclude on a haystack rejects that path but other files can match', () => {
    expect(itemMatchesDownloadSearch(item, 'matrix -1999')).toBe(true);
    expect(itemMatchesDownloadSearch(item, '-1999')).toBe(false);
    expect(itemMatchesDownloadSearch(item, 'matrix -sample')).toBe(true);
  });

  test('matches file name when title does not', () => {
    const onlyFile = {
      name: 'Unrelated Title',
      files: [{ name: 'special-episode.mkv' }],
    };
    expect(itemMatchesDownloadSearch(onlyFile, 'episode')).toBe(true);
    expect(itemMatchesDownloadSearch(onlyFile, '-episode')).toBe(false);
  });

  test('hyphen inside word is not exclude', () => {
    const tagged = { name: 'foo-bar release', files: [] };
    expect(itemMatchesDownloadSearch(tagged, 'foo-bar')).toBe(true);
    expect(itemMatchesDownloadSearch(tagged, '-release')).toBe(false);
  });
});

describe('getFilesVisibleForDownloadSearch', () => {
  const item = {
    name: 'Pack',
    files: [
      { id: 1, name: 'disc1.mkv' },
      { id: 2, name: 'sample-disc2.mkv' },
    ],
  };

  test('title match shows all files', () => {
    expect(getFilesVisibleForDownloadSearch(item, 'pack')).toHaveLength(2);
  });

  test('file-only match filters files', () => {
    const visible = getFilesVisibleForDownloadSearch(item, 'sample');
    expect(visible).toHaveLength(1);
    expect(visible[0].name).toBe('sample-disc2.mkv');
  });

  test('exclude applies to file list', () => {
    const visible = getFilesVisibleForDownloadSearch(item, 'disc -sample');
    expect(visible).toHaveLength(1);
    expect(visible[0].name).toBe('disc1.mkv');
  });
});

describe('itemHasFileNameSearchMatch', () => {
  test('false when only title matches', () => {
    const item = { name: 'visible title', files: [{ name: 'other.mkv' }] };
    expect(itemHasFileNameSearchMatch(item, 'visible')).toBe(false);
    expect(itemHasFileNameSearchMatch(item, 'other')).toBe(true);
  });
});

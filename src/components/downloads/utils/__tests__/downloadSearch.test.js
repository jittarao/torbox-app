import { describe, expect, test } from 'bun:test';
import {
  parseDownloadSearchQuery,
  itemMatchesDownloadSearch,
  getFilesVisibleForDownloadSearch,
  itemHasFileNameSearchMatch,
  shouldAutoExpandItemForSearch,
  MAX_AUTO_EXPAND_MATCHING_FILES,
} from '../downloadSearch.js';

describe('parseDownloadSearchQuery', () => {
  test('empty query', () => {
    expect(parseDownloadSearchQuery('')).toEqual({ include: [], exclude: [] });
  });

  test('single unquoted word', () => {
    expect(parseDownloadSearchQuery('foo')).toEqual({
      include: [{ type: 'or', alternatives: [['foo']] }],
      exclude: [],
    });
  });

  test('unquoted words form OR group', () => {
    expect(parseDownloadSearchQuery('foo bar')).toEqual({
      include: [{ type: 'or', alternatives: [['foo'], ['bar']] }],
      exclude: [],
    });
  });

  test('plus joins words into AND alternative', () => {
    expect(parseDownloadSearchQuery('foo+bar')).toEqual({
      include: [{ type: 'or', alternatives: [['foo', 'bar']] }],
      exclude: [],
    });
  });

  test('plus and space combine AND and OR', () => {
    expect(parseDownloadSearchQuery('foo+bar baz')).toEqual({
      include: [{ type: 'or', alternatives: [['foo', 'bar'], ['baz']] }],
      exclude: [],
    });
  });

  test('plus inside a token without a pair is literal', () => {
    expect(parseDownloadSearchQuery('c++')).toEqual({
      include: [{ type: 'or', alternatives: [['c++']] }],
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
        { type: 'or', alternatives: [['1080p'], ['bluray']] },
      ],
      exclude: [],
    });
  });

  test('exclude term', () => {
    expect(parseDownloadSearchQuery('movie -sample')).toEqual({
      include: [{ type: 'or', alternatives: [['movie']] }],
      exclude: [{ type: 'or', alternatives: [['sample']] }],
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

  test('plus requires all joined words', () => {
    expect(itemMatchesDownloadSearch(item, 'matrix+1999')).toBe(true);
    expect(itemMatchesDownloadSearch(item, 'matrix+720p')).toBe(false);
    expect(itemMatchesDownloadSearch(item, 'matrix+1999 720p')).toBe(true);
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

  test('unquoted words match whole tokens, not substrings inside tokens', () => {
    const alone = { name: 'Home Alone 1990', files: [] };
    const onePiece = { name: 'One Piece Batch', files: [] };
    expect(itemMatchesDownloadSearch(alone, 'one')).toBe(false);
    expect(itemMatchesDownloadSearch(alone, '"one"')).toBe(false);
    expect(itemMatchesDownloadSearch(onePiece, 'one')).toBe(true);
    expect(itemMatchesDownloadSearch(onePiece, '"one"')).toBe(true);
  });

  test('numbered token suffixes still match short prefixes', () => {
    const item = { name: 'disc1 backup', files: [] };
    expect(itemMatchesDownloadSearch(item, 'disc')).toBe(true);
    expect(itemMatchesDownloadSearch(item, 'disc1')).toBe(true);
    expect(itemMatchesDownloadSearch(item, 'discord')).toBe(false);
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

  test('title-only match shows all files when no file names match', () => {
    expect(getFilesVisibleForDownloadSearch(item, 'pack')).toHaveLength(2);
  });

  test('title and file match prefers matching files only', () => {
    const batch = {
      name: 'One Piece Batch',
      files: [
        { name: 'One Piece - 001.mkv' },
        { name: 'readme.txt' },
      ],
    };
    expect(getFilesVisibleForDownloadSearch(batch, 'one piece')).toHaveLength(1);
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

describe('shouldAutoExpandItemForSearch', () => {
  test('false when title already matches search', () => {
    const item = {
      name: 'One Piece Batch 02',
      files: [{ name: 'One Piece - 0131.mkv' }],
    };
    expect(shouldAutoExpandItemForSearch(item, 'one piece')).toBe(false);
  });

  test('true for small file-only matches', () => {
    const item = {
      name: 'Unrelated pack',
      files: [{ name: 'bonus-clip.mkv' }],
    };
    expect(shouldAutoExpandItemForSearch(item, 'bonus')).toBe(true);
  });

  test('false when too many files match', () => {
    const files = Array.from({ length: MAX_AUTO_EXPAND_MATCHING_FILES + 1 }, (_, i) => ({
      name: `episode-${i}.mkv`,
    }));
    const item = { name: 'Season pack', files };
    expect(shouldAutoExpandItemForSearch(item, 'episode')).toBe(false);
  });
});

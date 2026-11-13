import { describe, expect, test } from 'bun:test';
import {
  parseDownloadSearchQuery,
  itemMatchesDownloadSearch,
  getFilesVisibleForDownloadSearch,
  itemHasFileNameSearchMatch,
  shouldAutoExpandItemForSearch,
  MAX_AUTO_EXPAND_MATCHING_FILES,
  getParsedDownloadSearch,
  MAX_PARSED_SEARCH_CACHE,
  downloadSearchHasRankableTerms,
  scoreDownloadSearchResults,
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
    name: 'Frankenstein 1818 scan',
    files: [{ name: 'frankenstein.epub', short_name: 'frankenstein.epub' }],
  };

  test('OR matches any word in title', () => {
    expect(itemMatchesDownloadSearch(item, 'hardcover 720p')).toBe(false);
    expect(itemMatchesDownloadSearch(item, 'scan 720p')).toBe(true);
  });

  test('plus requires all joined words', () => {
    expect(itemMatchesDownloadSearch(item, 'frankenstein+1818')).toBe(true);
    expect(itemMatchesDownloadSearch(item, 'frankenstein+720p')).toBe(false);
    expect(itemMatchesDownloadSearch(item, 'frankenstein+1818 scan')).toBe(true);
  });

  test('quoted phrase requires exact substring', () => {
    expect(itemMatchesDownloadSearch(item, '"frankenstein 1818"')).toBe(true);
    expect(itemMatchesDownloadSearch(item, '"1818 scan"')).toBe(true);
    expect(itemMatchesDownloadSearch(item, '"frankenstein 720"')).toBe(false);
  });

  test('exclude on a haystack rejects that path but other files can match', () => {
    expect(itemMatchesDownloadSearch(item, 'frankenstein -1818')).toBe(true);
    expect(itemMatchesDownloadSearch(item, '-1818')).toBe(false);
    expect(itemMatchesDownloadSearch(item, 'frankenstein -sample')).toBe(true);
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
    const treasureIsland = { name: 'Treasure Island 1883', files: [] };
    const oneThousandNights = { name: 'One Thousand Nights', files: [] };
    expect(itemMatchesDownloadSearch(treasureIsland, 'one')).toBe(false);
    expect(itemMatchesDownloadSearch(treasureIsland, '"one"')).toBe(false);
    expect(itemMatchesDownloadSearch(oneThousandNights, 'one')).toBe(true);
    expect(itemMatchesDownloadSearch(oneThousandNights, '"one"')).toBe(true);
  });

  test('numbered token suffixes still match short prefixes', () => {
    const item = { name: 'disc1 backup', files: [] };
    expect(itemMatchesDownloadSearch(item, 'disc')).toBe(true);
    expect(itemMatchesDownloadSearch(item, 'disc1')).toBe(true);
    expect(itemMatchesDownloadSearch(item, 'discord')).toBe(false);
  });

  test('token prefix matching supports partial words', () => {
    const frankenstein = {
      name: 'gutenberg.org - Frankenstein (1818) Mary Shelley.epub',
      files: [],
    };
    expect(itemMatchesDownloadSearch(frankenstein, 'Franken')).toBe(true);
    expect(itemMatchesDownloadSearch(frankenstein, 'Frankenstein')).toBe(true);

    const shanios = { name: 'shanios.iso', files: [] };
    expect(itemMatchesDownloadSearch(shanios, 'shani')).toBe(true);
    expect(itemMatchesDownloadSearch(shanios, 'shan')).toBe(true);
    expect(itemMatchesDownloadSearch(shanios, 'sh')).toBe(true);

    const shanti = { name: 'shanti-release', files: [] };
    expect(itemMatchesDownloadSearch(shanti, 'shan')).toBe(true);
    expect(itemMatchesDownloadSearch(shanti, 'shanti')).toBe(true);
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
      name: 'Treasure Island Batch',
      files: [{ name: 'Treasure Island - ch01.epub' }, { name: 'readme.txt' }],
    };
    expect(getFilesVisibleForDownloadSearch(batch, 'treasure island')).toHaveLength(1);
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
      name: 'Treasure Island Batch 02',
      files: [{ name: 'Treasure Island - ch13.epub' }],
    };
    expect(shouldAutoExpandItemForSearch(item, 'treasure island')).toBe(false);
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

describe('getParsedDownloadSearch', () => {
  test('returns the same object reference on repeated calls', () => {
    const first = getParsedDownloadSearch('foo -bar');
    for (let i = 0; i < 999; i += 1) {
      expect(getParsedDownloadSearch('foo -bar')).toBe(first);
    }
  });

  test('evicts oldest entries when cache exceeds max size', () => {
    const first = getParsedDownloadSearch('__cache-test-query-0__');
    for (let i = 1; i <= MAX_PARSED_SEARCH_CACHE; i += 1) {
      getParsedDownloadSearch(`__cache-test-query-${i}__`);
    }
    expect(getParsedDownloadSearch('__cache-test-query-0__')).not.toBe(first);
  });
});

describe('downloadSearchHasRankableTerms', () => {
  test('false for empty and exclude-only queries', () => {
    expect(downloadSearchHasRankableTerms('')).toBe(false);
    expect(downloadSearchHasRankableTerms('   ')).toBe(false);
    expect(downloadSearchHasRankableTerms('-sample')).toBe(false);
  });

  test('true when the query has include terms', () => {
    expect(downloadSearchHasRankableTerms('foo')).toBe(true);
    expect(downloadSearchHasRankableTerms('"foo bar" -sample')).toBe(true);
  });
});

describe('scoreDownloadSearchResults', () => {
  /** Score each item among `items` (names or `{ name, files }`). */
  const scores = (items, query, filesByEntityKey) =>
    scoreDownloadSearchResults(
      items.map((item) => (typeof item === 'string' ? { name: item } : item)),
      query,
      filesByEntityKey
    );
  /** Names in relevance order. */
  const rank = (names, query) => {
    const itemScores = scores(names, query);
    return names
      .map((name, i) => ({ name, score: itemScores[i] }))
      .toSorted((a, b) => b.score - a.score)
      .map((entry) => entry.name);
  };

  test('zero without rankable terms', () => {
    expect(scores(['Foo Bar'], '')).toEqual([0]);
    expect(scores(['Foo Bar'], '-baz')).toEqual([0]);
    expect(scores([], 'foo')).toEqual([]);
  });

  test('titles matching more words rank higher', () => {
    expect(rank(['Foo.Baz.2020', 'Foo.Bar.2020'], 'foo bar')[0]).toBe('Foo.Bar.2020');
    expect(rank(['Foo.Baz', 'Foo.Baz.Qux'], 'foo baz qux')[0]).toBe('Foo.Baz.Qux');
  });

  test('title matches outrank file-only matches', () => {
    const [titleHit, fileHit] = scores(
      ['Bar Collection', { name: 'Collection', files: [{ name: 'bar.mkv' }] }],
      'bar'
    );
    expect(titleHit).toBeGreaterThan(fileHit);
    expect(fileHit).toBeGreaterThan(0);
  });

  test('file names fill in words missing from the title', () => {
    const files = [{ name: 'Foo.S01E01.mkv' }, { short_name: 'Bar.Extras.mkv' }];
    const [withFiles, titleOnly] = scores(
      [{ name: 'Foo Season 1', files }, { name: 'Foo Season 1' }],
      'foo bar'
    );
    expect(withFiles).toBeGreaterThan(titleOnly);
  });

  test('more matched words beat a better match on fewer words', () => {
    // Prefix matches on both words still beat an exact, leading match on one.
    expect(rank(['Foo', 'Release.Foobar.Barbaz'], 'foo bar')[0]).toBe('Release.Foobar.Barbaz');
  });

  test('words adjacent and in order rank higher', () => {
    expect(rank(['Office.Party.The.Movie', 'The.Office.US.S01'], 'the office')[0]).toBe(
      'The.Office.US.S01'
    );
  });

  test('exact tokens outrank prefix matches', () => {
    expect(rank(['Matrixx.Reloaded', 'Matrix.Reloaded'], 'matrix')[0]).toBe('Matrix.Reloaded');
  });

  test('titles the terms cover more of rank higher', () => {
    expect(rank(['Matrix.1999.1080p.BluRay.x264-GROUP', 'Matrix'], 'matrix')[0]).toBe('Matrix');
  });

  test('phrases and substring terms score as one term each', () => {
    expect(rank(['The Matrix 2003', 'The Matrix 1999'], '"the matrix" 1999')[0]).toBe(
      'The Matrix 1999'
    );
    expect(scores(['Movie.x264-GROUP'], 'x264-group')[0]).toBeGreaterThan(0);
  });

  test('reads file names from the side cache', () => {
    const item = { id: 1, assetType: 'torrents', name: 'Pack', files: [] };
    const [withCache] = scores([item], 'bar', { 'torrents:1': [{ name: 'bar.mkv' }] });
    const [withoutCache] = scores([item], 'bar');
    expect(withCache).toBeGreaterThan(withoutCache);
  });

  describe('common words', () => {
    const library = [
      'The.Thing.1982',
      'Office.Space.1999',
      'The.Matrix.1999',
      'The.Godfather.1972',
      'The.Office.US.S01',
    ];

    test('loose words found in most results count less', () => {
      expect(rank(library, 'the office')).toEqual([
        'The.Office.US.S01',
        'Office.Space.1999',
        'The.Thing.1982',
        'The.Matrix.1999',
        'The.Godfather.1972',
      ]);
    });

    test('a common word still counts when the rare word ties', () => {
      const [withThe, withoutThe] = scores(
        ['The.Office.Complete', 'Office.Space.1999', 'The.Thing', 'The.Matrix'],
        'the office'
      );
      expect(withThe).toBeGreaterThan(withoutThe);
    });

    test('equally common words keep full weight', () => {
      expect(rank(['Foo.Baz', 'Bar.Qux', 'Foo.Bar'], 'foo bar')[0]).toBe('Foo.Bar');
    });

    test('quoted words keep full weight', () => {
      const thing = library.indexOf('The.Thing.1982');
      expect(scores(library, 'the office')[thing]).toBeLessThan(50);
      expect(scores(library, '"the" office')[thing]).toBeGreaterThan(100);
    });

    test('plus-joined words keep full weight', () => {
      const results = ['The.Office', 'The.Thing', 'The.Matrix', 'The.Godfather'];
      const thing = results.indexOf('The.Thing');
      expect(scores(results, 'the office thing')[thing]).toBeLessThan(200);
      expect(scores(results, 'the+office thing')[thing]).toBeGreaterThan(200);
    });
  });
});

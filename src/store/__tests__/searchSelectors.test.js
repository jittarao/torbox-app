import { describe, expect, test } from 'bun:test';
import {
  applySearchFilters,
  selectDisplayResults,
  selectFilteredResults,
} from '../searchSelectors.js';

describe('searchSelectors', () => {
  const baseResults = [
    {
      title: 'Show S01E02 2020 1080p',
      raw_title: 'Show S01E02 2020 1080p',
      size: 2 * 1024 * 1024 * 1024,
      last_known_seeders: 10,
      cached: true,
      tracker: 'Example',
    },
    {
      title: 'Movie 2019 720p',
      raw_title: 'Movie 2019 720p',
      size: 500 * 1024 * 1024,
      last_known_seeders: 2,
      cached: false,
      tracker: 'Newznab',
    },
  ];

  test('applySearchFilters escapes regex metacharacters in season and episode filters', () => {
    const filtered = applySearchFilters(
      [
        {
          title: 'Show season 1.5 special',
          raw_title: 'Show season 1.5 special',
          size: 0,
          last_known_seeders: 0,
        },
        {
          title: 'Show season 1 special',
          raw_title: 'Show season 1 special',
          size: 0,
          last_known_seeders: 0,
        },
        {
          title: 'Show S01X special',
          raw_title: 'Show S01X special',
          size: 0,
          last_known_seeders: 0,
        },
      ],
      {
        seasonFilter: '1.',
        episodeFilter: '',
        yearFilter: '',
        qualityFilter: '',
        sizeFilter: '',
        seedersFilter: '',
      }
    );

    // Unescaped "." in padded s0 (`01.`) would incorrectly match "S01X".
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toContain('1.5');
  });

  test('applySearchFilters filters by season and quality', () => {
    const filtered = applySearchFilters(baseResults, {
      seasonFilter: '1',
      episodeFilter: '',
      yearFilter: '',
      qualityFilter: '1080p',
      sizeFilter: '',
      seedersFilter: '',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toContain('1080p');
  });

  test('selectFilteredResults uses passed filter fields', () => {
    const state = { results: baseResults };
    expect(
      selectFilteredResults(state, {
        seasonFilter: '',
        episodeFilter: '',
        yearFilter: '2019',
        qualityFilter: '',
        sizeFilter: '',
        seedersFilter: '',
      })
    ).toHaveLength(1);
  });

  test('selectDisplayResults applies cached-only and hides native indexers', () => {
    const state = {
      results: baseResults,
      searchType: 'torrents',
    };

    const emptyFilters = {
      seasonFilter: '',
      episodeFilter: '',
      yearFilter: '',
      qualityFilter: '',
      sizeFilter: '',
      seedersFilter: '',
    };

    const display = selectDisplayResults(
      state,
      {
        sortKey: 'size',
        sortDir: 'desc',
        showCachedOnly: true,
        hideTorBoxIndexers: true,
      },
      emptyFilters
    );

    expect(display).toHaveLength(1);
    expect(display[0].cached).toBe(true);
    expect(display[0].tracker).not.toBe('Newznab');
  });
});

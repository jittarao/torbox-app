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

  test('selectFilteredResults uses store filter fields', () => {
    const state = {
      results: baseResults,
      seasonFilter: '',
      episodeFilter: '',
      yearFilter: '2019',
      qualityFilter: '',
      sizeFilter: '',
      seedersFilter: '',
    };
    expect(selectFilteredResults(state)).toHaveLength(1);
  });

  test('selectDisplayResults applies cached-only and hides native indexers', () => {
    const state = {
      results: baseResults,
      seasonFilter: '',
      episodeFilter: '',
      yearFilter: '',
      qualityFilter: '',
      sizeFilter: '',
      seedersFilter: '',
      searchType: 'torrents',
    };

    const display = selectDisplayResults(state, {
      sortKey: 'size',
      sortDir: 'desc',
      showCachedOnly: true,
      hideTorBoxIndexers: true,
    });

    expect(display).toHaveLength(1);
    expect(display[0].cached).toBe(true);
    expect(display[0].tracker).not.toBe('Newznab');
  });
});

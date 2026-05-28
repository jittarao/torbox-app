import { describe, expect, test } from 'bun:test';
import {
  sortIds,
  filterIds,
  enrichRowForFilter,
  selectVisibleSortedIds,
} from '../downloadsDerivedSelectors.js';
import { entityKey } from '@/utils/downloadListMerge.js';
import { EMPTY_FILTERS } from '@/components/downloads/filters/filterHelpers.js';

describe('downloadsDerivedSelectors', () => {
  const entities = {
    [entityKey('torrents', 1)]: {
      id: 1,
      assetType: 'torrents',
      name: 'Alpha',
      added: '2020-01-01',
      created_at: '2020-01-01',
      download_finished: true,
      active: false,
      size: 100,
    },
    [entityKey('torrents', 2)]: {
      id: 2,
      assetType: 'torrents',
      name: 'Beta',
      added: '2020-01-03',
      created_at: '2020-01-03',
      download_finished: true,
      active: false,
      size: 200,
    },
  };

  const ids = [entityKey('torrents', 1), entityKey('torrents', 2)];

  test('sortIds orders by added desc', () => {
    const sorted = sortIds(ids, entities, 'created_at', 'desc');
    expect(sorted[0]).toBe(entityKey('torrents', 2));
    expect(sorted[1]).toBe(entityKey('torrents', 1));
  });

  test('sortIds orders by name asc', () => {
    const sorted = sortIds(ids, entities, 'name', 'asc');
    expect(sorted[0]).toBe(entityKey('torrents', 1));
  });

  test('filterIds matches search on name', () => {
    const filtered = filterIds(ids, entities, {
      search: 'beta',
      statusFilter: 'all',
      appliedFilters: EMPTY_FILTERS,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toBe(entityKey('torrents', 2));
  });

  test('enrichRowForFilter attaches tags', () => {
    const row = enrichRowForFilter(entities[entityKey('torrents', 1)], { 1: [{ id: 9, name: 'Tag' }] }, {
      itemDownloads: new Set(),
      fileDownloads: new Set(),
    });
    expect(row.tags).toHaveLength(1);
  });

  test('selectVisibleSortedIds combines filter and sort', () => {
    const torboxState = {
      entities,
      order: { torrents: ids, usenet: [], webdl: [] },
    };
    const visible = selectVisibleSortedIds(
      torboxState,
      'torrents',
      {
        search: '',
        statusFilter: 'all',
        appliedFilters: EMPTY_FILTERS,
        sortField: 'name',
        sortDirection: 'asc',
      },
      {},
      []
    );
    expect(visible).toHaveLength(2);
    expect(visible[0]).toBe(entityKey('torrents', 1));
  });
});

import { describe, expect, test } from 'bun:test';
import {
  sortIds,
  filterIds,
  enrichRowForFilter,
  selectVisibleSortedIds,
  countDownloadsPerTagFromStore,
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
      airlocked: false,
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
      airlocked: true,
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

  test('sortIds orders by airlocked boolean', () => {
    const sorted = sortIds(ids, entities, 'airlocked', 'desc');
    expect(sorted[0]).toBe(entityKey('torrents', 2));
    expect(sorted[1]).toBe(entityKey('torrents', 1));
  });

  describe('relevance sort', () => {
    const searchEntities = {
      [entityKey('torrents', 10)]: {
        id: 10,
        assetType: 'torrents',
        name: 'Foo.Only.2020',
        created_at: '2020-02-03',
      },
      [entityKey('torrents', 11)]: {
        id: 11,
        assetType: 'torrents',
        name: 'Foo.Bar.2019',
        created_at: '2020-02-01',
      },
      [entityKey('torrents', 12)]: {
        id: 12,
        assetType: 'torrents',
        name: 'Bar.Only.2021',
        created_at: '2020-02-02',
      },
    };
    const searchIds = Object.keys(searchEntities);

    test('ranks items matching more words first, then newest first', () => {
      const sorted = sortIds(searchIds, searchEntities, 'relevance', 'desc', {
        search: 'foo bar',
      });
      expect(sorted).toEqual([
        entityKey('torrents', 11),
        entityKey('torrents', 10),
        entityKey('torrents', 12),
      ]);
    });

    test('falls back to newest first without rankable terms', () => {
      const sorted = sortIds(searchIds, searchEntities, 'relevance', 'desc', { search: '' });
      expect(sorted).toEqual([
        entityKey('torrents', 10),
        entityKey('torrents', 12),
        entityKey('torrents', 11),
      ]);
    });

    test('selectVisibleSortedIds passes the search to the relevance sort', () => {
      const visible = selectVisibleSortedIds(
        { entities: searchEntities, order: { torrents: searchIds } },
        'torrents',
        { search: 'foo bar', statusFilter: 'all', sortField: 'relevance' }
      );
      expect(visible[0]).toBe(entityKey('torrents', 11));
    });
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
    const row = enrichRowForFilter(
      entities[entityKey('torrents', 1)],
      { 1: [{ id: 9, name: 'Tag' }] },
      {
        itemDownloads: new Set(),
        fileDownloads: new Set(),
      }
    );
    expect(row.tags).toHaveLength(1);
  });

  test('enrichRowForFilter does not expose upstream TorBox tags without TBM mappings', () => {
    const entity = {
      ...entities[entityKey('torrents', 1)],
      tags: ['upstream-only'],
    };
    const lookup = { itemDownloads: new Set(), fileDownloads: new Set() };
    const row = enrichRowForFilter(entity, {}, lookup);
    expect(row.tags).toEqual([]);
    expect(row).not.toBe(entity);
  });

  test('countDownloadsPerTagFromStore ignores upstream-only TorBox tags', () => {
    const torboxState = {
      entities: {
        [entityKey('torrents', 1)]: {
          ...entities[entityKey('torrents', 1)],
          tags: ['upstream-only'],
        },
      },
      order: { torrents: [entityKey('torrents', 1)], usenet: [], webdl: [] },
    };
    expect(countDownloadsPerTagFromStore(torboxState, 'torrents', {})).toEqual({});
    expect(
      countDownloadsPerTagFromStore(torboxState, 'torrents', {
        1: [{ id: 42, name: 'TBM' }],
      })
    ).toEqual({ 42: 1 });
  });

  test('enrichRowForFilter reuses entity reference when unchanged', () => {
    const entity = entities[entityKey('torrents', 1)];
    const lookup = { itemDownloads: new Set(), fileDownloads: new Set() };
    const row = enrichRowForFilter(entity, {}, lookup);
    expect(row).toBe(entity);
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

  test('selectVisibleSortedIds accepts prebuilt download history lookup', () => {
    const torboxState = {
      entities,
      order: { torrents: ids, usenet: [], webdl: [] },
    };
    const lookup = {
      itemDownloads: new Set(['torrents:1']),
      fileDownloads: new Set(),
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
      lookup
    );
    expect(visible).toHaveLength(2);
  });
});

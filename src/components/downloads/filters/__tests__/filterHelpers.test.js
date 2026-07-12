import { describe, expect, test } from 'bun:test';
import {
  LOGIC_OPERATORS,
  STRING_OPERATORS,
} from '@/components/downloads/AutomationRules/constants';
import {
  buildTagFilter,
  buildTrackerFilter,
  buildSourceFilter,
  getActiveTagIds,
  getActiveTrackers,
  getActiveSources,
  isTagOnlyFilter,
  isTrackerOnlyFilter,
  isSourceOnlyFilter,
  itemMatchesAnyViewFilters,
  mergeViewAssetTypeFilter,
  migrateCustomViewFilters,
  normalizeFilters,
  FILTER_SCHEMA_VERSION,
  EMPTY_FILTERS,
} from '../filterHelpers';
import { itemMatchesFilters } from '../filterEvaluation';

describe('tag filter helpers', () => {
  test('buildTagFilter and getActiveTagIds round-trip multiple ids', () => {
    const filters = buildTagFilter([1, 2, 3]);
    expect(isTagOnlyFilter(filters)).toBe(true);
    expect(getActiveTagIds(filters)).toEqual([1, 2, 3]);
  });
});

describe('tracker filter helpers', () => {
  const urlA = 'https://tracker.example.com/announce';
  const urlB = 'https://tracker.other.org/announce';

  test('buildTrackerFilter creates OR group of tracker equals rules', () => {
    const filters = buildTrackerFilter([urlA, urlB]);
    expect(filters.logicOperator).toBe(LOGIC_OPERATORS.AND);
    expect(filters.groups).toHaveLength(1);
    expect(filters.groups[0].logicOperator).toBe(LOGIC_OPERATORS.OR);
    expect(filters.groups[0].filters).toEqual([
      { column: 'tracker', operator: STRING_OPERATORS.EQUALS, value: urlA },
      { column: 'tracker', operator: STRING_OPERATORS.EQUALS, value: urlB },
    ]);
  });

  test('buildTrackerFilter returns empty filters for no urls', () => {
    expect(buildTrackerFilter([])).toEqual(EMPTY_FILTERS);
    expect(buildTrackerFilter(['', '  '])).toEqual(EMPTY_FILTERS);
  });

  test('isTrackerOnlyFilter and getActiveTrackers round-trip', () => {
    const filters = buildTrackerFilter([urlA, urlB]);
    expect(isTrackerOnlyFilter(filters)).toBe(true);
    expect(getActiveTrackers(filters)).toEqual([urlA, urlB]);
  });

  test('getActiveTrackers returns null for mixed filters', () => {
    const filters = {
      logicOperator: LOGIC_OPERATORS.AND,
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters: [
            { column: 'tracker', operator: STRING_OPERATORS.EQUALS, value: urlA },
            { column: 'name', operator: STRING_OPERATORS.CONTAINS, value: 'test' },
          ],
        },
      ],
    };
    expect(isTrackerOnlyFilter(filters)).toBe(false);
    expect(getActiveTrackers(filters)).toBeNull();
  });
});

describe('source filter helpers', () => {
  const hostA = 'pixeldrain.com';
  const hostB = 'drive.google.com';

  test('buildSourceFilter creates OR group of original_url equals rules', () => {
    const filters = buildSourceFilter([hostA, hostB]);
    expect(filters.logicOperator).toBe(LOGIC_OPERATORS.AND);
    expect(filters.groups).toHaveLength(1);
    expect(filters.groups[0].logicOperator).toBe(LOGIC_OPERATORS.OR);
    expect(filters.groups[0].filters).toEqual([
      { column: 'original_url', operator: STRING_OPERATORS.EQUALS, value: hostA },
      { column: 'original_url', operator: STRING_OPERATORS.EQUALS, value: hostB },
    ]);
  });

  test('buildSourceFilter returns empty filters for no hosts', () => {
    expect(buildSourceFilter([])).toEqual(EMPTY_FILTERS);
    expect(buildSourceFilter(['', '  '])).toEqual(EMPTY_FILTERS);
  });

  test('isSourceOnlyFilter and getActiveSources round-trip', () => {
    const filters = buildSourceFilter([hostA, hostB]);
    expect(isSourceOnlyFilter(filters)).toBe(true);
    expect(getActiveSources(filters)).toEqual([hostA, hostB]);
  });

  test('getActiveSources returns null for mixed filters', () => {
    const filters = {
      logicOperator: LOGIC_OPERATORS.AND,
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters: [
            { column: 'original_url', operator: STRING_OPERATORS.EQUALS, value: hostA },
            { column: 'name', operator: STRING_OPERATORS.CONTAINS, value: 'test' },
          ],
        },
      ],
    };
    expect(isSourceOnlyFilter(filters)).toBe(false);
    expect(getActiveSources(filters)).toBeNull();
  });
});

describe('itemMatchesAnyViewFilters', () => {
  const viewA = {
    id: 1,
    asset_type: 'torrents',
    filters: {
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters: [{ column: 'name', operator: STRING_OPERATORS.CONTAINS, value: 'alpha' }],
        },
      ],
    },
  };
  const viewB = {
    id: 2,
    asset_type: 'torrents',
    filters: {
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters: [{ column: 'name', operator: STRING_OPERATORS.CONTAINS, value: 'beta' }],
        },
      ],
    },
  };

  test('matches item when any view filter matches', () => {
    const alphaItem = { name: 'alpha release', asset_type: 'torrents' };
    const betaItem = { name: 'beta build', asset_type: 'torrents' };
    const otherItem = { name: 'gamma', asset_type: 'torrents' };

    expect(itemMatchesAnyViewFilters(alphaItem, [viewA, viewB])).toBe(true);
    expect(itemMatchesAnyViewFilters(betaItem, [viewA, viewB])).toBe(true);
    expect(itemMatchesAnyViewFilters(otherItem, [viewA, viewB])).toBe(false);
  });

  test('single-view semantics match itemMatchesFilters', () => {
    const item = { name: 'alpha release', asset_type: 'torrents' };
    const filters = mergeViewAssetTypeFilter(viewA.filters, viewA.asset_type);
    expect(itemMatchesAnyViewFilters(item, [viewA])).toBe(itemMatchesFilters(item, filters));
  });
});

describe('migrateCustomViewFilters', () => {
  test('migrates legacy created_at days to age hours', () => {
    const legacy = {
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters: [{ column: 'created_at', operator: 'lt', value: 7 }],
        },
      ],
    };
    const migrated = migrateCustomViewFilters(legacy);
    expect(migrated.groups[0].filters[0]).toEqual({
      column: 'age',
      operator: 'lt',
      value: 168,
    });
    expect(migrated._filterSchemaVersion).toBe(FILTER_SCHEMA_VERSION);
  });

  test('migrates legacy size MB to GB', () => {
    const legacy = {
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters: [{ column: 'size', operator: 'gt', value: 10240 }],
        },
      ],
    };
    const migrated = migrateCustomViewFilters(legacy);
    expect(migrated.groups[0].filters[0].value).toBe(10);
  });

  test('normalizeFilters applies migration automatically', () => {
    const normalized = normalizeFilters({
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters: [{ column: 'cached_at', operator: 'gt', value: 1 }],
        },
      ],
    });
    expect(normalized.groups[0].filters[0].column).toBe('seeding_time');
    expect(normalized.groups[0].filters[0].value).toBe(24);
  });

  test('does not re-migrate already versioned filters', () => {
    const current = {
      _filterSchemaVersion: FILTER_SCHEMA_VERSION,
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters: [{ column: 'size', operator: 'gt', value: 10 }],
        },
      ],
    };
    const migrated = migrateCustomViewFilters(current);
    expect(migrated.groups[0].filters[0].value).toBe(10);
  });
});

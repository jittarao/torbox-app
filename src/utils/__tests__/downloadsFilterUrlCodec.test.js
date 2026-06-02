import { describe, expect, test } from 'bun:test';
import { STATUS_OPTIONS } from '@/components/constants';
import {
  parseStatusFilterParam,
  serializeStatusFilterParam,
  compactFiltersToUrl,
  compactFiltersFromUrl,
  parseTagIdsFromParams,
  writeTagIdsToParams,
  writeViewIdToParams,
  parseViewIdParam,
  parseAppliedFiltersFromParams,
  writeAppliedFiltersToParams,
  tryParseLegacyFilters,
} from '@/utils/downloadsFilterUrlCodec';
import { LOGIC_OPERATORS, MULTI_SELECT_OPERATORS } from '@/components/downloads/AutomationRules/constants';
import { hasActiveFilters } from '@/components/downloads/filters/filterHelpers';

describe('downloadsFilterUrlCodec status', () => {
  test('parseStatusFilterParam returns all when empty', () => {
    expect(parseStatusFilterParam(null)).toBe('all');
    expect(parseStatusFilterParam('')).toBe('all');
  });

  test('round-trips stalled slug', () => {
    const stalled = STATUS_OPTIONS.find((o) => o.label === 'Stalled');
    const internal = [JSON.stringify(stalled.value)];
    expect(serializeStatusFilterParam(internal)).toBe('stalled');
    expect(parseStatusFilterParam('stalled')).toEqual(internal);
  });

  test('round-trips multiple status slugs', () => {
    const stalled = STATUS_OPTIONS.find((o) => o.label === 'Stalled');
    const completed = STATUS_OPTIONS.find((o) => o.label === 'Completed');
    const internal = [JSON.stringify(stalled.value), JSON.stringify(completed.value)];
    expect(serializeStatusFilterParam(internal)).toBe('stalled,completed');
    expect(parseStatusFilterParam('stalled,completed')).toEqual(internal);
  });

  test('serializeStatusFilterParam clears for all', () => {
    expect(serializeStatusFilterParam('all')).toBeNull();
    expect(serializeStatusFilterParam(null)).toBeNull();
  });

  test('legacy double-encoded status does not throw', () => {
    const stalled = STATUS_OPTIONS.find((o) => o.label === 'Stalled');
    const legacy = encodeURIComponent(JSON.stringify([JSON.stringify(stalled.value)]));
    expect(() => parseStatusFilterParam(legacy)).not.toThrow();
  });
});

describe('downloadsFilterUrlCodec tag and view params', () => {
  test('parseTagIdsFromParams reads tag and tags', () => {
    expect(parseTagIdsFromParams(new URLSearchParams('tag=2'))).toEqual([2]);
    expect(parseTagIdsFromParams(new URLSearchParams('tags=2,5'))).toEqual([2, 5]);
  });

  test('writeTagIdsToParams uses single encoding', () => {
    const params = new URLSearchParams();
    writeTagIdsToParams(params, [2]);
    expect(params.toString()).toBe('tag=2');
    expect(params.toString()).not.toContain('%255B');
  });

  test('writeViewIdToParams sets view id', () => {
    const params = new URLSearchParams();
    writeViewIdToParams(params, 42);
    expect(params.get('view')).toBe('42');
    expect(params.get('filters')).toBeNull();
  });

  test('parseViewIdParam parses numeric id', () => {
    expect(parseViewIdParam('42')).toBe(42);
  });
});

describe('downloadsFilterUrlCodec compact filters', () => {
  const threeRuleFilter = {
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.AND,
        filters: [
          { column: 'tags', operator: 'is_not_set', value: [], _key: 'x' },
          {
            column: 'download_state',
            operator: MULTI_SELECT_OPERATORS.IS_NONE_OF,
            value: ['queued', 'failed', 'inactive'],
          },
          {
            column: 'asset_type',
            operator: MULTI_SELECT_OPERATORS.IS_ANY_OF,
            value: ['torrents'],
          },
        ],
      },
    ],
  };

  test('compact round-trip for three-rule filter', () => {
    const url = compactFiltersToUrl(threeRuleFilter);
    expect(url).not.toContain('_key');
    expect(url).toContain('"g"');
    const restored = compactFiltersFromUrl(url);
    expect(hasActiveFilters(restored)).toBe(true);
    expect(restored.groups[0].filters).toHaveLength(3);
    expect(restored.groups[0].filters[0].column).toBe('tags');
    expect(restored.groups[0].filters[1].value).toEqual(['queued', 'failed', 'inactive']);
  });

  test('writeAppliedFiltersToParams uses tag shortcut', () => {
    const params = new URLSearchParams();
    const tagFilter = {
      logicOperator: LOGIC_OPERATORS.AND,
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters: [{ column: 'tags', operator: MULTI_SELECT_OPERATORS.IS_ANY_OF, value: [2] }],
        },
      ],
    };
    const storage = {
      maxLength: 1800,
      overflowKey: 'test-overflow',
      setJSON: () => {},
      removeItem: () => {},
    };
    writeAppliedFiltersToParams(params, tagFilter, storage);
    expect(params.get('tag')).toBe('2');
    expect(params.get('filters')).toBeNull();
  });

  test('legacy production filters URL does not throw', () => {
    const legacy =
      '%7B%22logicOperator%22%3A%22and%22%2C%22groups%22%3A%5B%7B%22logicOperator%22%3A%22and%22%2C%22filters%22%3A%5B%7B%22column%22%3A%22tags%22%2C%22operator%22%3A%22is_not_set%22%2C%22value%22%3A%5B%5D%7D%5D%7D%5D%7D';
    expect(() => tryParseLegacyFilters(legacy)).not.toThrow();
    const result = compactFiltersFromUrl(legacy);
    expect(result.groups).toBeDefined();
  });

  test('legacy double-encoded filters URL does not throw', () => {
    const legacy = encodeURIComponent(
      JSON.stringify({
        logicOperator: 'and',
        groups: [{ logicOperator: 'and', filters: [{ column: 'tags', operator: 'is_any_of', value: [2] }] }],
      })
    );
    expect(() => compactFiltersFromUrl(legacy)).not.toThrow();
  });

  test('parseAppliedFiltersFromParams with view returns empty filters', () => {
    const params = new URLSearchParams('view=42');
    const filters = parseAppliedFiltersFromParams(params);
    expect(hasActiveFilters(filters)).toBe(false);
  });

  test('single URL encoding for compact filters', () => {
    const params = new URLSearchParams();
    const storage = {
      maxLength: 1800,
      overflowKey: 'test-overflow',
      setJSON: () => {},
      removeItem: () => {},
    };
    writeAppliedFiltersToParams(params, threeRuleFilter, storage);
    const qs = params.toString();
    expect(qs).not.toContain('%255B');
    expect(qs.startsWith('filters=')).toBe(true);
  });
});

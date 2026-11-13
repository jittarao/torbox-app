import { describe, expect, test } from 'bun:test';
import { STATUS_OPTIONS } from '@/components/constants';
import {
  downloadsSearchParamFromValue,
  parseStatusFilterParam,
  serializeStatusFilterParam,
  shouldWriteAppliedFiltersInCriteriaPatch,
  writeSearchToParams,
  writeSortToParams,
} from '@/hooks/useDownloadsFilterParams';
import { resolveDownloadsSort } from '@/components/downloads/utils/downloadsSort';
import { LOGIC_OPERATORS } from '@/components/downloads/AutomationRules/constants';

describe('downloadsFilterParams search URL encoding', () => {
  test('preserves spaces while typing multi-word queries', () => {
    expect(downloadsSearchParamFromValue('foo bar')).toBe('foo bar');
    expect(downloadsSearchParamFromValue('foo ')).toBe('foo ');
    expect(downloadsSearchParamFromValue(' leading')).toBe(' leading');
  });

  test('clears search param for empty input', () => {
    expect(downloadsSearchParamFromValue('')).toBeNull();
    expect(downloadsSearchParamFromValue(null)).toBeNull();
  });
});

describe('shouldWriteAppliedFiltersInCriteriaPatch', () => {
  const sampleFilters = {
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.AND,
        filters: [{ column: 'name', operator: 'contains', value: 'test' }],
      },
    ],
  };

  test('writes filters when clearing view and tag in the same patch', () => {
    expect(
      shouldWriteAppliedFiltersInCriteriaPatch({
        viewId: null,
        tagIds: null,
        appliedFilters: sampleFilters,
      })
    ).toBe(true);
  });

  test('skips filters when selecting a saved view', () => {
    expect(
      shouldWriteAppliedFiltersInCriteriaPatch({
        viewId: 42,
        appliedFilters: sampleFilters,
      })
    ).toBe(false);
  });

  test('skips filters when selecting multiple views', () => {
    expect(
      shouldWriteAppliedFiltersInCriteriaPatch({
        viewIds: [1, 2],
        appliedFilters: sampleFilters,
      })
    ).toBe(false);
  });

  test('skips filters when selecting a tag shortcut', () => {
    expect(
      shouldWriteAppliedFiltersInCriteriaPatch({
        tagIds: [3],
        appliedFilters: sampleFilters,
      })
    ).toBe(false);
  });

  test('skips filters when selecting tracker shortcut', () => {
    expect(
      shouldWriteAppliedFiltersInCriteriaPatch({
        trackerUrls: ['https://tracker.example.com/announce'],
        appliedFilters: sampleFilters,
      })
    ).toBe(false);
  });

  test('skips filters when selecting source shortcut', () => {
    expect(
      shouldWriteAppliedFiltersInCriteriaPatch({
        sourceHosts: ['pixeldrain.com'],
        appliedFilters: sampleFilters,
      })
    ).toBe(false);
  });

  test('writes filters when only appliedFilters is present', () => {
    expect(shouldWriteAppliedFiltersInCriteriaPatch({ appliedFilters: sampleFilters })).toBe(true);
  });
});

describe('downloadsFilterParams status URL encoding', () => {
  test('parseStatusFilterParam returns all when empty', () => {
    expect(parseStatusFilterParam(null)).toBe('all');
    expect(parseStatusFilterParam('')).toBe('all');
  });

  test('round-trips a single status filter via slug', () => {
    const stalled = STATUS_OPTIONS.find((o) => o.label === 'Stalled');
    const filter = JSON.stringify(stalled.value);
    const encoded = serializeStatusFilterParam([filter]);
    expect(encoded).toBe('stalled');
    expect(parseStatusFilterParam(encoded)).toEqual([filter]);
  });

  test('round-trips multiple status filters via slugs', () => {
    const stalled = STATUS_OPTIONS.find((o) => o.label === 'Stalled');
    const completed = STATUS_OPTIONS.find((o) => o.label === 'Completed');
    const a = JSON.stringify(stalled.value);
    const b = JSON.stringify(completed.value);
    const encoded = serializeStatusFilterParam([a, b]);
    expect(encoded).toBe('stalled,completed');
    expect(parseStatusFilterParam(encoded)).toEqual([a, b]);
  });

  test('legacy double-encoded status parses without throwing', () => {
    const stalled = STATUS_OPTIONS.find((o) => o.label === 'Stalled');
    const legacy = encodeURIComponent(JSON.stringify([JSON.stringify(stalled.value)]));
    expect(() => parseStatusFilterParam(legacy)).not.toThrow();
  });

  test('serializeStatusFilterParam clears for all', () => {
    expect(serializeStatusFilterParam('all')).toBeNull();
    expect(serializeStatusFilterParam(null)).toBeNull();
  });
});

describe('downloads sort URL encoding', () => {
  const write = (initial, sortField, sortDirection) => {
    const params = new URLSearchParams(initial);
    writeSortToParams(params, sortField, sortDirection);
    return params.toString();
  };

  test('omits the default sort outside a search', () => {
    expect(write('', 'created_at', 'desc')).toBe('');
    expect(write('', 'created_at', 'asc')).toBe('dir=asc');
    expect(write('', 'size', 'desc')).toBe('sort=size');
  });

  test('keeps an explicit default sort while searching', () => {
    expect(write('q=foo', 'created_at', 'desc')).toBe('q=foo&sort=created_at');
  });

  test('relevance clears the sort params', () => {
    expect(write('q=foo&sort=size&dir=asc', 'relevance')).toBe('q=foo');
  });

  test('clearing the search drops a redundant default sort', () => {
    const params = new URLSearchParams('q=foo&sort=created_at');
    writeSearchToParams(params, '');
    expect(params.toString()).toBe('');

    const kept = new URLSearchParams('q=foo&sort=size');
    writeSearchToParams(kept, '');
    expect(kept.toString()).toBe('sort=size');
  });
});

describe('resolveDownloadsSort', () => {
  const base = { sortField: 'created_at', sortDirection: 'desc' };

  test('searches without an explicit sort rank by relevance', () => {
    expect(resolveDownloadsSort({ ...base, hasExplicitSort: false, search: 'foo bar' })).toEqual({
      sortField: 'relevance',
      sortDirection: 'desc',
    });
  });

  test('explicit sorts win over relevance', () => {
    expect(
      resolveDownloadsSort({
        sortField: 'size',
        sortDirection: 'asc',
        hasExplicitSort: true,
        search: 'foo',
      })
    ).toEqual({ sortField: 'size', sortDirection: 'asc' });
  });

  test('no search or exclude-only search uses the default sort', () => {
    expect(resolveDownloadsSort({ ...base, hasExplicitSort: false, search: '' })).toEqual(base);
    expect(resolveDownloadsSort({ ...base, hasExplicitSort: false, search: '-sample' })).toEqual(
      base
    );
    expect(
      resolveDownloadsSort({ sortField: 'relevance', hasExplicitSort: true, search: '' })
    ).toEqual(base);
  });
});

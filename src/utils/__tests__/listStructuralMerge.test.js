import { describe, expect, it } from 'bun:test';
import { mergeListWithStructuralSharing, rowsShallowEqual } from '@/utils/listStructuralMerge';

describe('rowsShallowEqual', () => {
  it('returns true for same reference', () => {
    const row = { id: 1, name: 'a' };
    expect(rowsShallowEqual(row, row)).toBe(true);
  });

  it('returns true for shallow-equal objects', () => {
    expect(rowsShallowEqual({ id: 1, name: 'a' }, { id: 1, name: 'a' })).toBe(true);
  });

  it('returns false when a field differs', () => {
    expect(rowsShallowEqual({ id: 1, name: 'a' }, { id: 1, name: 'b' })).toBe(false);
  });
});

describe('mergeListWithStructuralSharing', () => {
  it('reuses previous row references when data is unchanged', () => {
    const prev = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ];
    const next = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ];

    const merged = mergeListWithStructuralSharing(prev, next, (row) => row.id);
    expect(merged).toBe(prev);
    expect(merged[0]).toBe(prev[0]);
    expect(merged[1]).toBe(prev[1]);
  });

  it('returns next list when previous list is empty', () => {
    const next = [{ id: 1, name: 'a' }];
    const merged = mergeListWithStructuralSharing([], next, (row) => row.id);
    expect(merged).toBe(next);
  });

  it('reuses unchanged rows and replaces changed rows', () => {
    const prev = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ];
    const next = [
      { id: 1, name: 'a' },
      { id: 2, name: 'changed' },
    ];

    const merged = mergeListWithStructuralSharing(prev, next, (row) => row.id);
    expect(merged).not.toBe(prev);
    expect(merged[0]).toBe(prev[0]);
    expect(merged[1]).toBe(next[1]);
  });
});

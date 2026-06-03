import { describe, expect, it } from 'bun:test';
import { applyShiftRangeToSet } from '@/hooks/useShiftRangeRowSelection';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
const getRowId = (item) => item.id;

describe('applyShiftRangeToSet', () => {
  it('toggles a single row when shift is not held', () => {
    const { next, lastIndex } = applyShiftRangeToSet(
      new Set(),
      'b',
      true,
      1,
      false,
      null,
      items,
      getRowId
    );
    expect([...next]).toEqual(['b']);
    expect(lastIndex).toBe(1);
  });

  it('selects an inclusive range between the anchor and shift-clicked row', () => {
    const { next, lastIndex } = applyShiftRangeToSet(
      new Set(['a']),
      'd',
      true,
      3,
      true,
      0,
      items,
      getRowId
    );
    expect([...next].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(lastIndex).toBe(3);
  });

  it('deselects an inclusive range when unchecked', () => {
    const { next } = applyShiftRangeToSet(
      new Set(['a', 'b', 'c', 'd']),
      'b',
      false,
      1,
      true,
      3,
      items,
      getRowId
    );
    expect([...next]).toEqual(['a']);
  });
});

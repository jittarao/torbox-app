import { describe, expect, test } from 'bun:test';
import { computeRangeSelection } from '@/components/downloads/FiltersSidebar/sidebarRangeSelect';

describe('computeRangeSelection', () => {
  test('activate merges range without duplicates', () => {
    expect(computeRangeSelection([1, 3], [3, 4, 5], true)).toEqual([1, 3, 4, 5]);
  });

  test('activate preserves out-of-range selections', () => {
    expect(computeRangeSelection([10], [2, 3], true)).toEqual([10, 2, 3]);
  });

  test('deactivate removes only in-range IDs', () => {
    expect(computeRangeSelection([1, 2, 3, 4], [2, 3], false)).toEqual([1, 4]);
  });

  test('view IDs match loosely via string normalize', () => {
    expect(computeRangeSelection(['1', '2'], [2, 3], true, String)).toEqual(['1', '2', '3']);
    expect(computeRangeSelection([1, 2, 3], ['2'], false, String)).toEqual([1, 3]);
  });

  test('tag IDs normalize to numbers', () => {
    expect(computeRangeSelection([1], ['2', '3'], true, Number)).toEqual([1, 2, 3]);
    expect(computeRangeSelection([1, 2, 3], [2], false, Number)).toEqual([1, 3]);
  });

  test('tracker URLs use string keys', () => {
    const urlA = 'https://tracker.example.com/announce';
    const urlB = 'https://tracker.other.org/announce';
    expect(computeRangeSelection([urlA], [urlB], true, String)).toEqual([urlA, urlB]);
    expect(computeRangeSelection([urlA, urlB], [urlA], false, String)).toEqual([urlB]);
  });
});

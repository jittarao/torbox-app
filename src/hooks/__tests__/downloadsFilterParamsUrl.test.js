import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  getDownloadsFilterSearchParamsSnapshot,
  resetDownloadsFilterSearchParamsCacheForTests,
} from '@/hooks/downloadsFilterParamsUrl';

describe('downloadsFilterParamsUrl snapshot', () => {
  beforeEach(() => {
    resetDownloadsFilterSearchParamsCacheForTests();
  });

  afterEach(() => {
    window.location.search = '';
    resetDownloadsFilterSearchParamsCacheForTests();
  });

  test('getDownloadsFilterSearchParamsSnapshot returns the same reference when search is unchanged', () => {
    const first = getDownloadsFilterSearchParamsSnapshot();
    const second = getDownloadsFilterSearchParamsSnapshot();
    expect(second).toBe(first);
  });

  test('getDownloadsFilterSearchParamsSnapshot returns a new reference when search changes', () => {
    const first = getDownloadsFilterSearchParamsSnapshot();
    window.location.search = '?q=test';
    const second = getDownloadsFilterSearchParamsSnapshot();
    expect(second).not.toBe(first);
    expect(second.get('q')).toBe('test');
  });
});

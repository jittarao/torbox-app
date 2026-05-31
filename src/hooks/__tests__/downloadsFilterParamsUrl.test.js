import { describe, expect, test, beforeEach } from 'bun:test';
import {
  getDownloadsFilterSearchParamsSnapshot,
  resetDownloadsFilterSearchParamsCacheForTests,
} from '@/hooks/downloadsFilterParamsUrl';

describe('downloadsFilterParamsUrl snapshot', () => {
  beforeEach(() => {
    resetDownloadsFilterSearchParamsCacheForTests();
  });

  test('getDownloadsFilterSearchParamsSnapshot returns the same reference when search is unchanged', () => {
    const first = getDownloadsFilterSearchParamsSnapshot();
    const second = getDownloadsFilterSearchParamsSnapshot();
    expect(second).toBe(first);
  });

  test('getDownloadsFilterSearchParamsSnapshot returns a new reference when search changes', () => {
    const first = getDownloadsFilterSearchParamsSnapshot();
    window.history.replaceState(window.history.state, '', '?q=test');
    const second = getDownloadsFilterSearchParamsSnapshot();
    expect(second).not.toBe(first);
    expect(second.get('q')).toBe('test');
    window.history.replaceState(window.history.state, '', '/');
    resetDownloadsFilterSearchParamsCacheForTests();
  });
});

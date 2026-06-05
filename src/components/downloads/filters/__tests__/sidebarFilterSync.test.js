import { describe, expect, test } from 'bun:test';
import {
  buildTagFilter,
  sameViewId,
  sidebarUrlMatchesPending,
} from '@/components/downloads/filters/sidebarFilterSync';
import { EMPTY_FILTERS } from '@/components/downloads/filters/filterHelpers';

describe('sidebarFilterSync', () => {
  test('sameViewId compares loosely', () => {
    expect(sameViewId(1, '1')).toBe(true);
    expect(sameViewId(1, 2)).toBe(false);
  });

  test('view pending waits until URL view id updates', () => {
    const pending = { kind: 'view', viewId: 2 };
    expect(sidebarUrlMatchesPending(1, EMPTY_FILTERS, pending)).toBe(false);
    expect(sidebarUrlMatchesPending(2, EMPTY_FILTERS, pending)).toBe(true);
  });

  test('tag pending waits until URL tag updates and view param is cleared', () => {
    const tagB = buildTagFilter(2);
    const pending = { kind: 'tag', tagId: 2 };

    expect(sidebarUrlMatchesPending(1, buildTagFilter(1), pending)).toBe(false);
    expect(sidebarUrlMatchesPending(null, buildTagFilter(1), pending)).toBe(false);
    expect(sidebarUrlMatchesPending(null, tagB, pending)).toBe(true);
  });

  test('clear pending waits until URL has no view or tag filters', () => {
    const pending = { kind: 'clear' };
    expect(sidebarUrlMatchesPending(1, EMPTY_FILTERS, pending)).toBe(false);
    expect(sidebarUrlMatchesPending(null, buildTagFilter(3), pending)).toBe(false);
    expect(sidebarUrlMatchesPending(null, EMPTY_FILTERS, pending)).toBe(true);
  });
});

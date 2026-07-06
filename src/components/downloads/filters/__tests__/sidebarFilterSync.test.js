import { describe, expect, test } from 'bun:test';
import {
  buildTagFilter,
  buildTrackerFilter,
  buildSourceFilter,
  sameViewId,
  sameViewIdList,
  sidebarUrlMatchesPending,
} from '@/components/downloads/filters/sidebarFilterSync';
import { EMPTY_FILTERS } from '@/components/downloads/filters/filterHelpers';

describe('sidebarFilterSync', () => {
  test('sameViewId compares loosely', () => {
    expect(sameViewId(1, '1')).toBe(true);
    expect(sameViewId(1, 2)).toBe(false);
  });

  test('sameViewIdList is order-sensitive', () => {
    expect(sameViewIdList([1, 2], [1, 2])).toBe(true);
    expect(sameViewIdList([1, 2], [2, 1])).toBe(false);
  });

  test('view pending waits until URL view ids update', () => {
    const pending = { kind: 'view', viewIds: [2] };
    expect(sidebarUrlMatchesPending([1], EMPTY_FILTERS, pending)).toBe(false);
    expect(sidebarUrlMatchesPending([2], EMPTY_FILTERS, pending)).toBe(true);
  });

  test('multi-view pending waits for ordered view ids', () => {
    const pending = { kind: 'view', viewIds: [1, 2] };
    expect(sidebarUrlMatchesPending([1], EMPTY_FILTERS, pending)).toBe(false);
    expect(sidebarUrlMatchesPending([2, 1], EMPTY_FILTERS, pending)).toBe(false);
    expect(sidebarUrlMatchesPending([1, 2], EMPTY_FILTERS, pending)).toBe(true);
  });

  test('tag pending waits until URL tag ids update and view param is cleared', () => {
    const tagB = buildTagFilter([2, 3]);
    const pending = { kind: 'tag', tagIds: [2, 3] };

    expect(sidebarUrlMatchesPending([1], buildTagFilter([1]), pending)).toBe(false);
    expect(sidebarUrlMatchesPending([], buildTagFilter([1]), pending)).toBe(false);
    expect(sidebarUrlMatchesPending([], tagB, pending)).toBe(true);
  });

  test('clear pending waits until URL has no view or tag filters', () => {
    const pending = { kind: 'clear' };
    expect(sidebarUrlMatchesPending([1], EMPTY_FILTERS, pending)).toBe(false);
    expect(sidebarUrlMatchesPending([], buildTagFilter(3), pending)).toBe(false);
    expect(sidebarUrlMatchesPending([], EMPTY_FILTERS, pending)).toBe(true);
  });

  test('tracker pending waits until URL trackers update', () => {
    const urlA = 'https://tracker.example.com/announce';
    const urlB = 'https://tracker.other.org/announce';
    const pending = { kind: 'tracker', trackers: [urlA, urlB] };

    expect(sidebarUrlMatchesPending([], buildTrackerFilter([urlA]), pending)).toBe(false);
    expect(sidebarUrlMatchesPending([], buildTrackerFilter([urlB, urlA]), pending)).toBe(true);
  });

  test('clear pending waits until tracker filters are cleared', () => {
    const pending = { kind: 'clear' };
    const urlA = 'https://tracker.example.com/announce';
    expect(sidebarUrlMatchesPending([], buildTrackerFilter([urlA]), pending)).toBe(false);
    expect(sidebarUrlMatchesPending([], EMPTY_FILTERS, pending)).toBe(true);
  });

  test('source pending waits until URL sources update', () => {
    const hostA = 'pixeldrain.com';
    const hostB = 'drive.google.com';
    const pending = { kind: 'source', sources: [hostA, hostB] };

    expect(sidebarUrlMatchesPending([], buildSourceFilter([hostA]), pending)).toBe(false);
    expect(sidebarUrlMatchesPending([], buildSourceFilter([hostB, hostA]), pending)).toBe(true);
  });

  test('clear pending waits until source filters are cleared', () => {
    const pending = { kind: 'clear' };
    expect(sidebarUrlMatchesPending([], buildSourceFilter(['pixeldrain.com']), pending)).toBe(
      false
    );
    expect(sidebarUrlMatchesPending([], EMPTY_FILTERS, pending)).toBe(true);
  });
});

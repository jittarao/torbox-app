import { describe, expect, test } from 'bun:test';
import {
  parseTagIdsFromParams,
  writeTagIdsToParams,
  parseViewIdsFromParams,
  writeViewIdsToParams,
  parseTrackersFromParams,
  writeTrackersToParams,
  parseAppliedFiltersFromParams,
  writeAppliedFiltersToParams,
} from '@/utils/downloadsFilterUrlCodec';
import {
  buildTagFilter,
  buildTrackerFilter,
  getActiveTagIds,
  getActiveTrackers,
} from '@/components/downloads/filters/filterHelpers';

describe('downloadsFilterUrlCodec tag params', () => {
  test('parseTagIdsFromParams reads single and multi tag params', () => {
    expect(parseTagIdsFromParams(new URLSearchParams({ tag: '3' }))).toEqual([3]);
    expect(parseTagIdsFromParams(new URLSearchParams({ tags: '1,2,5' }))).toEqual([1, 2, 5]);
  });

  test('writeTagIdsToParams round-trips single and multi tags', () => {
    const single = new URLSearchParams();
    writeTagIdsToParams(single, [7]);
    expect(single.get('tag')).toBe('7');
    expect(single.get('tags')).toBeNull();

    const multi = new URLSearchParams();
    writeTagIdsToParams(multi, [1, 2]);
    expect(multi.get('tags')).toBe('1,2');
    expect(multi.get('tag')).toBeNull();
  });

  test('parseAppliedFiltersFromParams builds multi-tag filter', () => {
    const params = new URLSearchParams({ tags: '1,2' });
    const filters = parseAppliedFiltersFromParams(params);
    expect(getActiveTagIds(filters)).toEqual([1, 2]);
  });
});

describe('downloadsFilterUrlCodec view params', () => {
  test('parseViewIdsFromParams reads single and multi view params', () => {
    expect(parseViewIdsFromParams(new URLSearchParams({ view: '3' }))).toEqual([3]);
    expect(parseViewIdsFromParams(new URLSearchParams({ views: '1,2,5' }))).toEqual([1, 2, 5]);
  });

  test('writeViewIdsToParams preserves order for multi views', () => {
    const multi = new URLSearchParams();
    writeViewIdsToParams(multi, [2, 1, 3]);
    expect(multi.get('views')).toBe('2,1,3');
    expect(parseViewIdsFromParams(multi)).toEqual([2, 1, 3]);
  });

  test('writeViewIdsToParams uses view param for single selection', () => {
    const single = new URLSearchParams();
    writeViewIdsToParams(single, [9]);
    expect(single.get('view')).toBe('9');
    expect(single.get('views')).toBeNull();
  });
});

describe('downloadsFilterUrlCodec tracker params', () => {
  const urlA = 'https://tracker.example.com/announce';
  const urlB = 'https://tracker.other.org/announce?passkey=abc';

  test('parseTrackersFromParams reads single tracker param', () => {
    const params = new URLSearchParams({ tracker: urlA });
    expect(parseTrackersFromParams(params)).toEqual([urlA]);
  });

  test('parseTrackersFromParams reads pipe-delimited trackers param', () => {
    const params = new URLSearchParams({
      trackers: `${encodeURIComponent(urlA)}|${encodeURIComponent(urlB)}`,
    });
    expect(parseTrackersFromParams(params)).toEqual([urlA, urlB]);
  });

  test('writeTrackersToParams round-trips single and multi trackers', () => {
    const single = new URLSearchParams();
    writeTrackersToParams(single, [urlA]);
    expect(single.get('tracker')).toBe(urlA);
    expect(single.get('trackers')).toBeNull();

    const multi = new URLSearchParams();
    writeTrackersToParams(multi, [urlA, urlB]);
    expect(multi.get('trackers')).toBe(`${encodeURIComponent(urlA)}|${encodeURIComponent(urlB)}`);
    expect(multi.get('tracker')).toBeNull();
  });

  test('parseAppliedFiltersFromParams prefers tracker shortcut', () => {
    const params = new URLSearchParams({ tracker: urlA });
    const filters = parseAppliedFiltersFromParams(params);
    expect(getActiveTrackers(filters)).toEqual([urlA]);
  });

  test('writeAppliedFiltersToParams uses tracker shortcut for tracker-only filters', () => {
    const params = new URLSearchParams();
    const storage = {
      maxLength: 1800,
      overflowKey: 'test-overflow',
      setJSON: () => {},
      removeItem: () => {},
    };
    const filters = buildTrackerFilter([urlA, urlB]);
    const ok = writeAppliedFiltersToParams(params, filters, storage);
    expect(ok).toBe(true);
    expect(parseTrackersFromParams(params)).toEqual([urlA, urlB]);
  });
});

import { describe, expect, test } from 'bun:test';
import {
  parseTagIdsFromParams,
  writeTagIdsToParams,
  parseViewIdsFromParams,
  writeViewIdsToParams,
  parseTrackersFromParams,
  writeTrackersToParams,
  parseSourcesFromParams,
  writeSourcesToParams,
  parseAppliedFiltersFromParams,
  writeAppliedFiltersToParams,
} from '@/utils/downloadsFilterUrlCodec';
import {
  buildTagFilter,
  buildTrackerFilter,
  buildSourceFilter,
  getActiveTagIds,
  getActiveTrackers,
  getActiveSources,
  getTagCombineMode,
} from '@/components/downloads/filters/filterHelpers';
import { COMBINE_MODES } from '@/components/downloads/filters/sidebarCombineMode';

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

  test('parseAppliedFiltersFromParams respects tagsOp=all', () => {
    const params = new URLSearchParams({ tags: '1,2', tagsOp: 'all' });
    const filters = parseAppliedFiltersFromParams(params);
    expect(getTagCombineMode(filters)).toBe(COMBINE_MODES.ALL);
  });

  test('writeTagIdsToParams writes tagsOp for all mode', () => {
    const multi = new URLSearchParams();
    writeTagIdsToParams(multi, [1, 2], COMBINE_MODES.ALL);
    expect(multi.get('tags')).toBe('1,2');
    expect(multi.get('tagsOp')).toBe('all');
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

  test('writeViewIdsToParams writes viewsOp for all mode', () => {
    const multi = new URLSearchParams();
    writeViewIdsToParams(multi, [1, 2], COMBINE_MODES.ALL);
    expect(multi.get('views')).toBe('1,2');
    expect(multi.get('viewsOp')).toBe('all');
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

describe('downloadsFilterUrlCodec source params', () => {
  const hostA = 'pixeldrain.com';
  const hostB = 'drive.google.com';

  test('parseSourcesFromParams reads single source param', () => {
    const params = new URLSearchParams({ source: hostA });
    expect(parseSourcesFromParams(params)).toEqual([hostA]);
  });

  test('parseSourcesFromParams reads pipe-delimited sources param', () => {
    const params = new URLSearchParams({
      sources: `${encodeURIComponent(hostA)}|${encodeURIComponent(hostB)}`,
    });
    expect(parseSourcesFromParams(params)).toEqual([hostA, hostB]);
  });

  test('writeSourcesToParams round-trips single and multi sources', () => {
    const single = new URLSearchParams();
    writeSourcesToParams(single, [hostA]);
    expect(single.get('source')).toBe(hostA);
    expect(single.get('sources')).toBeNull();

    const multi = new URLSearchParams();
    writeSourcesToParams(multi, [hostA, hostB]);
    expect(multi.get('sources')).toBe(`${encodeURIComponent(hostA)}|${encodeURIComponent(hostB)}`);
    expect(multi.get('source')).toBeNull();
  });

  test('parseAppliedFiltersFromParams prefers source shortcut after tracker', () => {
    const params = new URLSearchParams({ source: hostA });
    const filters = parseAppliedFiltersFromParams(params);
    expect(getActiveSources(filters)).toEqual([hostA]);
  });

  test('writeAppliedFiltersToParams uses source shortcut for source-only filters', () => {
    const params = new URLSearchParams();
    const storage = {
      maxLength: 1800,
      overflowKey: 'test-overflow',
      setJSON: () => {},
      removeItem: () => {},
    };
    const filters = buildSourceFilter([hostA, hostB]);
    const ok = writeAppliedFiltersToParams(params, filters, storage);
    expect(ok).toBe(true);
    expect(parseSourcesFromParams(params)).toEqual([hostA, hostB]);
  });
});

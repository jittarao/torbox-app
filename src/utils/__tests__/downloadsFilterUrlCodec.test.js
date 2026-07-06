import { describe, expect, test } from 'bun:test';
import {
  parseTrackersFromParams,
  writeTrackersToParams,
  parseAppliedFiltersFromParams,
  writeAppliedFiltersToParams,
} from '@/utils/downloadsFilterUrlCodec';
import {
  buildTrackerFilter,
  getActiveTrackers,
} from '@/components/downloads/filters/filterHelpers';

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

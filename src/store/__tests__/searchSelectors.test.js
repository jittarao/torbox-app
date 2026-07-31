import { describe, expect, test } from 'bun:test';
import { applyStreamFilters, selectDisplayResults } from '../searchSelectors.js';

describe('searchSelectors (stremio streams)', () => {
  const results = [
    {
      key: 'a',
      title: 'Cached 1080p',
      cached: true,
      resolution: '1080p',
      codec: 'x265',
      hdr: 'HDR',
      language: 'ENG',
      streamType: 'movie',
      size: 2 * 1024 * 1024 * 1024,
      addonId: 'com.a',
      sources: [{ addonId: 'com.a', addonName: 'A' }],
    },
    {
      key: 'b',
      title: 'Uncached 720p',
      cached: false,
      resolution: '720p',
      codec: 'x264',
      hdr: null,
      language: 'Multi',
      streamType: 'series',
      size: 500 * 1024 * 1024,
      addonId: 'com.b',
      sources: [{ addonId: 'com.b', addonName: 'B' }],
    },
    {
      key: 'c',
      title: 'HEVC DV',
      cached: true,
      resolution: '2160p',
      codec: 'HEVC',
      hdr: 'DV',
      language: 'English',
      streamType: 'movie',
      size: 40 * 1024 * 1024 * 1024,
      addonId: 'com.a',
      sources: [{ addonId: 'com.a', addonName: 'A' }],
    },
  ];

  test('applyStreamFilters cached-only and resolution', () => {
    const filtered = applyStreamFilters(results, {
      showCachedOnly: true,
      resolution: '1080p',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe('a');
  });

  test('applyStreamFilters by addon and codec', () => {
    const filtered = applyStreamFilters(results, {
      addonId: 'com.b',
      codec: 'avc',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe('b');
  });

  test('applyStreamFilters codec aliases match HEVC and x265', () => {
    const filtered = applyStreamFilters(results, { codec: 'hevc' });
    expect(filtered.map((r) => r.key).sort()).toEqual(['a', 'c']);
  });

  test('applyStreamFilters hdr aliases', () => {
    const filtered = applyStreamFilters(results, { hdr: 'DV' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe('c');
  });

  test('applyStreamFilters by stream type', () => {
    const filtered = applyStreamFilters(results, { streamTypes: ['series'] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe('b');
  });

  test('applyStreamFilters max size excludes larger files', () => {
    const filtered = applyStreamFilters(results, {
      maxSizeBytes: 20 * 1024 * 1024 * 1024,
    });
    expect(filtered.map((r) => r.key).sort()).toEqual(['a', 'b']);
  });

  test('applyStreamFilters min and max size range', () => {
    const filtered = applyStreamFilters(results, {
      minSizeBytes: 1 * 1024 * 1024 * 1024,
      maxSizeBytes: 20 * 1024 * 1024 * 1024,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe('a');
  });

  test('applyStreamFilters language matches filename', () => {
    const withFile = [
      ...results,
      {
        key: 'd',
        title: '⚡ 4K',
        language: null,
        filename: 'Show.S01E01.1080p.BluRay.x265.ENG.mkv',
        description: '',
        streamType: 'series',
        size: 3 * 1024 * 1024 * 1024,
        addonId: 'com.a',
        sources: [{ addonId: 'com.a', addonName: 'A' }],
      },
    ];
    const filtered = applyStreamFilters(withFile, { language: 'ENG' });
    expect(filtered.map((r) => r.key).sort()).toEqual(['a', 'c', 'd']);
  });

  test('selectDisplayResults sorts by size', () => {
    const display = selectDisplayResults(results, {}, 'size', 'desc');
    expect(display[0].key).toBe('c');
    expect(display[1].key).toBe('a');
    expect(display[2].key).toBe('b');
  });
});

import { describe, expect, test } from 'bun:test';
import {
  downloadsSearchParamFromValue,
  parseStatusFilterParam,
  serializeStatusFilterParam,
} from '@/hooks/useDownloadsFilterParams';

describe('downloadsFilterParams search URL encoding', () => {
  test('preserves spaces while typing multi-word queries', () => {
    expect(downloadsSearchParamFromValue('foo bar')).toBe('foo bar');
    expect(downloadsSearchParamFromValue('foo ')).toBe('foo ');
    expect(downloadsSearchParamFromValue(' leading')).toBe(' leading');
  });

  test('clears search param for empty input', () => {
    expect(downloadsSearchParamFromValue('')).toBeNull();
    expect(downloadsSearchParamFromValue(null)).toBeNull();
  });
});

describe('downloadsFilterParams status URL encoding', () => {
  test('parseStatusFilterParam returns all when empty', () => {
    expect(parseStatusFilterParam(null)).toBe('all');
    expect(parseStatusFilterParam('')).toBe('all');
  });

  test('round-trips a single status filter array', () => {
    const filter = JSON.stringify({ active: true, download_finished: false });
    const encoded = serializeStatusFilterParam([filter]);
    expect(parseStatusFilterParam(encoded)).toEqual([filter]);
  });

  test('round-trips multiple status filters', () => {
    const a = JSON.stringify({ active: true });
    const b = JSON.stringify({ download_finished: true, active: false });
    const encoded = serializeStatusFilterParam([a, b]);
    expect(parseStatusFilterParam(encoded)).toEqual([a, b]);
  });

  test('parseStatusFilterParam supports legacy single-object string', () => {
    const legacy = JSON.stringify({ active: true, download_finished: false });
    expect(parseStatusFilterParam(legacy)).toBe(legacy);
  });

  test('serializeStatusFilterParam clears for all', () => {
    expect(serializeStatusFilterParam('all')).toBeNull();
    expect(serializeStatusFilterParam(null)).toBeNull();
  });
});

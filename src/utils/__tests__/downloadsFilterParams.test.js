import { describe, expect, test } from 'bun:test';
import { STATUS_OPTIONS } from '@/components/constants';
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

  test('round-trips a single status filter via slug', () => {
    const stalled = STATUS_OPTIONS.find((o) => o.label === 'Stalled');
    const filter = JSON.stringify(stalled.value);
    const encoded = serializeStatusFilterParam([filter]);
    expect(encoded).toBe('stalled');
    expect(parseStatusFilterParam(encoded)).toEqual([filter]);
  });

  test('round-trips multiple status filters via slugs', () => {
    const stalled = STATUS_OPTIONS.find((o) => o.label === 'Stalled');
    const completed = STATUS_OPTIONS.find((o) => o.label === 'Completed');
    const a = JSON.stringify(stalled.value);
    const b = JSON.stringify(completed.value);
    const encoded = serializeStatusFilterParam([a, b]);
    expect(encoded).toBe('stalled,completed');
    expect(parseStatusFilterParam(encoded)).toEqual([a, b]);
  });

  test('legacy double-encoded status parses without throwing', () => {
    const stalled = STATUS_OPTIONS.find((o) => o.label === 'Stalled');
    const legacy = encodeURIComponent(JSON.stringify([JSON.stringify(stalled.value)]));
    expect(() => parseStatusFilterParam(legacy)).not.toThrow();
  });

  test('serializeStatusFilterParam clears for all', () => {
    expect(serializeStatusFilterParam('all')).toBeNull();
    expect(serializeStatusFilterParam(null)).toBeNull();
  });
});

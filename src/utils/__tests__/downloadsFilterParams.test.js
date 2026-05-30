import { describe, expect, test } from 'bun:test';
import {
  parseStatusFilterParam,
  serializeStatusFilterParam,
} from '@/hooks/useDownloadsFilterParams';

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

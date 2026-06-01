import { describe, expect, test } from 'bun:test';
import { normalizeUploadId } from '../utils';

describe('normalizeUploadId', () => {
  test('accepts positive numbers and numeric strings', () => {
    expect(normalizeUploadId(42)).toBe(42);
    expect(normalizeUploadId('42')).toBe(42);
  });

  test('rejects invalid values', () => {
    expect(normalizeUploadId(null)).toBe(null);
    expect(normalizeUploadId(undefined)).toBe(null);
    expect(normalizeUploadId('')).toBe(null);
    expect(normalizeUploadId('abc')).toBe(null);
    expect(normalizeUploadId(0)).toBe(null);
    expect(normalizeUploadId(-1)).toBe(null);
  });
});

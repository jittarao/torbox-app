import { describe, expect, test } from 'bun:test';
import {
  getUploadRowErrorMessage,
  isTransientDeferralMessage,
  isUploadDeferred,
  normalizeUploadId,
} from '../utils';

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

describe('upload deferral helpers', () => {
  test('isTransientDeferralMessage matches known auto-retry messages', () => {
    expect(isTransientDeferralMessage('TorBox API unavailable. Will retry automatically.')).toBe(
      true
    );
    expect(isTransientDeferralMessage('Permanent failure')).toBe(false);
  });

  test('getUploadRowErrorMessage hides transient deferrals on queued uploads', () => {
    expect(
      getUploadRowErrorMessage({
        status: 'queued',
        error_message: 'Uncached rate limit reached. Will retry automatically.',
      })
    ).toBeNull();

    expect(
      getUploadRowErrorMessage({
        status: 'failed',
        error_message: 'Uncached rate limit reached. Will retry automatically.',
      })
    ).not.toBeNull();

    expect(
      getUploadRowErrorMessage({
        status: 'queued',
        error_message: 'File not found: /tmp/missing.torrent',
      })
    ).toContain('File not found');
  });

  test('isUploadDeferred is true when next_attempt_at is in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isUploadDeferred(future)).toBe(true);
    expect(isUploadDeferred(past)).toBe(false);
    expect(isUploadDeferred(null)).toBe(false);
  });
});

import { describe, expect, test } from 'bun:test';
import {
  AIRLOCK_LIMIT_REACHED_ERROR,
  isKnownTorboxErrorCode,
  isNonRetryableResponse,
  isTorboxServerFault,
  NON_RETRYABLE_ERRORS,
  TORBOX_ERROR_CODES,
} from '../errors.js';

describe('TorBox error classification', () => {
  test('codes ending in ERROR are server faults', () => {
    expect(isTorboxServerFault('DATABASE_ERROR')).toBe(true);
    expect(isTorboxServerFault('AUTH_ERROR')).toBe(true);
    expect(isTorboxServerFault('UNKNOWN_ERROR')).toBe(true);
    expect(isTorboxServerFault('NO_SERVERS_AVAILABLE_ERROR')).toBe(true);
    expect(isTorboxServerFault('BAD_TOKEN')).toBe(false);
    expect(isTorboxServerFault('NO_AUTH')).toBe(false);
    expect(isTorboxServerFault('ITEM_NOT_FOUND')).toBe(false);
  });

  test('NON_RETRYABLE_ERRORS excludes server faults', () => {
    expect(NON_RETRYABLE_ERRORS.BAD_TOKEN).toBe('BAD_TOKEN');
    expect(NON_RETRYABLE_ERRORS.NO_AUTH).toBe('NO_AUTH');
    expect(NON_RETRYABLE_ERRORS.AUTH_ERROR).toBeUndefined();
    expect(NON_RETRYABLE_ERRORS.DATABASE_ERROR).toBeUndefined();
    expect(NON_RETRYABLE_ERRORS[AIRLOCK_LIMIT_REACHED_ERROR]).toBe(AIRLOCK_LIMIT_REACHED_ERROR);
  });

  test('isNonRetryableResponse follows success/error contract', () => {
    expect(isNonRetryableResponse({ success: false, error: 'BAD_TOKEN' })).toBe(true);
    expect(isNonRetryableResponse({ success: false, error: 'DUPLICATE_ITEM' })).toBe(true);
    expect(isNonRetryableResponse({ success: false, error: 'DATABASE_ERROR' })).toBe(false);
    expect(isNonRetryableResponse({ success: false, error: 'AUTH_ERROR' })).toBe(false);
    expect(isNonRetryableResponse({ success: false, error: 'UNKNOWN_ERROR' })).toBe(false);
    expect(isNonRetryableResponse({ success: true, error: null })).toBe(false);
  });

  test('catalog includes documented codes', () => {
    expect(isKnownTorboxErrorCode(TORBOX_ERROR_CODES.BOZO_FILE)).toBe(true);
    expect(isKnownTorboxErrorCode(TORBOX_ERROR_CODES.LINK_OFFLINE)).toBe(true);
    expect(isKnownTorboxErrorCode('NOT_A_REAL_CODE')).toBe(false);
  });
});

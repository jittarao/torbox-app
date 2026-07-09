import { describe, expect, test } from 'bun:test';
import {
  isItemProtected,
  partitionItemsByProtection,
  formatProtectedSkipSuffix,
  protectedIdsToMap,
} from '../downloadProtectionUtils.js';

describe('downloadProtectionUtils', () => {
  test('protectedIdsToMap builds sparse lookup map', () => {
    expect(protectedIdsToMap(['1', 2])).toEqual({ 1: true, 2: true });
    expect(protectedIdsToMap()).toEqual({});
  });

  test('isItemProtected reads is_protected flag', () => {
    expect(isItemProtected({ is_protected: true })).toBe(true);
    expect(isItemProtected({ is_protected: false })).toBe(false);
  });

  test('partitionItemsByProtection splits items', () => {
    const items = [
      { id: 1, is_protected: true },
      { id: 2, is_protected: false },
    ];
    const { allowed, blocked } = partitionItemsByProtection(items);
    expect(blocked).toHaveLength(1);
    expect(allowed).toHaveLength(1);
  });

  test('formatProtectedSkipSuffix returns localized suffix', () => {
    const t = (key, values) => `${values.count} skipped`;
    expect(formatProtectedSkipSuffix(2, t)).toBe('2 skipped');
    expect(formatProtectedSkipSuffix(0, t)).toBeNull();
  });
});

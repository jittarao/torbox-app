import { describe, expect, test } from 'bun:test';
import {
  buildCacheKey,
  getSupportedActions,
  getSupportedConditions,
  isActionSupported,
  isConditionSupported,
  normalizeAssetTypes,
} from '../helpers/ruleCapabilities.js';

describe('ruleCapabilities', () => {
  test('buildCacheKey sorts asset types', () => {
    expect(buildCacheKey(['usenet', 'torrent'])).toBe('torrent|usenet');
  });

  test('normalizeAssetTypes rejects empty and invalid', () => {
    expect(() => normalizeAssetTypes([])).toThrow();
    expect(() => normalizeAssetTypes(['torrent', 'bad'])).toThrow();
    expect(normalizeAssetTypes(['webdl', 'torrent'])).toEqual(['torrent', 'webdl']);
  });

  test('torrent has full condition and action sets', () => {
    const conditions = getSupportedConditions(['torrent']);
    const actions = getSupportedActions(['torrent']);
    expect(conditions).toContain('RATIO');
    expect(conditions).toContain('DOWNLOAD_STALLED_TIME');
    expect(actions).toContain('stop_seeding');
    expect(actions).toContain('archive');
  });

  test('usenet excludes torrent-only conditions and actions', () => {
    const conditions = getSupportedConditions(['usenet']);
    const actions = getSupportedActions(['usenet']);
    expect(conditions).not.toContain('RATIO');
    expect(conditions).not.toContain('DOWNLOAD_STALLED_TIME');
    expect(conditions).not.toContain('LAST_DOWNLOAD_ACTIVITY_AT');
    expect(conditions).toContain('STATUS');
    expect(conditions).toContain('PROGRESS');
    expect(actions).not.toContain('stop_seeding');
    expect(actions).not.toContain('archive');
    expect(actions).toContain('delete');
    expect(actions).toContain('force_start');
  });

  test('torrent+usenet intersection excludes torrent-only', () => {
    const conditions = getSupportedConditions(['torrent', 'usenet']);
    const actions = getSupportedActions(['torrent', 'usenet']);
    expect(conditions).not.toContain('RATIO');
    expect(conditions).toContain('STATUS');
    expect(actions).not.toContain('archive');
    expect(actions).toContain('delete');
  });

  test('isConditionSupported and isActionSupported', () => {
    expect(isConditionSupported('RATIO', ['torrent'])).toBe(true);
    expect(isConditionSupported('RATIO', ['usenet'])).toBe(false);
    expect(isActionSupported('archive', ['webdl'])).toBe(false);
    expect(isActionSupported('delete', ['webdl'])).toBe(true);
  });

  test('caches repeated lookups', () => {
    const a = getSupportedConditions(['torrent', 'usenet']);
    const b = getSupportedConditions(['torrent', 'usenet']);
    expect(a).toBe(b);
  });
});

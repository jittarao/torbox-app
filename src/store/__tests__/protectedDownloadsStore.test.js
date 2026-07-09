import { describe, expect, test } from 'bun:test';
import { applyOptimisticProtectedMap } from '../protectedDownloadsStore.js';
import { protectedIdsToMap } from '@/utils/downloadProtectionUtils';

describe('protectedDownloadsStore helpers', () => {
  test('applyOptimisticProtectedMap protects and unprotects ids', () => {
    const next = applyOptimisticProtectedMap({}, ['1', '2'], true);
    expect(next).toEqual({ 1: true, 2: true });

    const cleared = applyOptimisticProtectedMap(next, ['1'], false);
    expect(cleared).toEqual({ 2: true });
  });

  test('protectedIdsToMap matches store lookup semantics', () => {
    const map = protectedIdsToMap(['1', '2']);
    const partial = applyOptimisticProtectedMap(map, ['1'], false);
    expect(partial).toEqual({ 2: true });
    expect(protectedIdsToMap(['2'])).toEqual(partial);
  });
});

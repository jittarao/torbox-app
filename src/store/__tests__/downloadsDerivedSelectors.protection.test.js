import { describe, expect, test } from 'bun:test';
import { enrichRowForFilter } from '../downloadsDerivedSelectors.js';

describe('enrichRowForFilter protection', () => {
  test('attaches is_protected from protected map', () => {
    const entity = { id: '42', name: 'Test', assetType: 'torrents' };
    const row = enrichRowForFilter(entity, {}, null, { 42: true });
    expect(row.is_protected).toBe(true);
  });

  test('defaults is_protected to false when not in map', () => {
    const entity = { id: '42', name: 'Test', assetType: 'torrents' };
    const row = enrichRowForFilter(entity, {}, null, {});
    expect(row.is_protected).not.toBe(true);
  });
});

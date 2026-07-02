import { describe, expect, test } from 'bun:test';
import {
  buildRowDataSignature,
  collectDirtyRowKeys,
  viewIdsOrderUnchanged,
} from '../downloadListSignatures.js';
import { entityKey } from '../downloadListMerge.js';

describe('downloadListSignatures', () => {
  const key1 = entityKey('torrents', 1);
  const key2 = entityKey('torrents', 2);

  test('viewIdsOrderUnchanged detects order changes', () => {
    expect(viewIdsOrderUnchanged([key1, key2], [key1, key2])).toBe(true);
    expect(viewIdsOrderUnchanged([key1, key2], [key2, key1])).toBe(false);
  });

  test('collectDirtyRowKeys returns null when view order changes', () => {
    const sigs = new Map([[key1, buildRowDataSignature(key1, { id: 1, progress: 0 })]]);
    expect(collectDirtyRowKeys([key2, key1], {}, sigs, [key1, key2])).toBe(null);
  });

  test('collectDirtyRowKeys lists only changed keys', () => {
    const entity1 = { id: 1, progress: 10, assetType: 'torrents' };
    const entity2 = { id: 2, progress: 0, assetType: 'torrents' };
    const sigs = new Map([
      [key1, buildRowDataSignature(key1, entity1)],
      [key2, buildRowDataSignature(key2, entity2)],
    ]);

    const dirty = collectDirtyRowKeys(
      [key1, key2],
      { [key1]: { ...entity1, progress: 50 }, [key2]: entity2 },
      sigs,
      [key1, key2]
    );

    expect(dirty).toEqual([key1]);
  });

  test('collectDirtyRowKeys marks a row dirty when airlocked changes', () => {
    const entity1 = { id: 1, progress: 0, assetType: 'torrents', airlocked: false };
    const sigs = new Map([[key1, buildRowDataSignature(key1, entity1)]]);

    const dirty = collectDirtyRowKeys(
      [key1],
      { [key1]: { ...entity1, airlocked: true } },
      sigs,
      [key1]
    );

    expect(dirty).toEqual([key1]);
  });
});

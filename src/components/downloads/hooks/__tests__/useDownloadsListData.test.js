import { describe, expect, test } from 'bun:test';
import { buildRowDataSignature, collectDirtyRowKeys } from '@/utils/downloadListSignatures';

function buildViewIdIndexMap(viewIds) {
  const map = new Map();
  for (let i = 0; i < viewIds.length; i++) {
    map.set(viewIds[i], i);
  }
  return map;
}

describe('useDownloadsListData dirty-key path', () => {
  test('incremental enrichment only revisits dirty row keys', () => {
    const entities = {
      'torrents:1': { id: 1, progress: 10, files: [] },
      'torrents:2': { id: 2, progress: 50, files: [] },
    };
    const viewIds = ['torrents:1', 'torrents:2'];
    const prevSigs = new Map([
      ['torrents:1', buildRowDataSignature('torrents:1', entities['torrents:1'])],
      ['torrents:2', buildRowDataSignature('torrents:2', entities['torrents:2'])],
    ]);

    entities['torrents:2'] = { ...entities['torrents:2'], progress: 55 };
    const dirty = collectDirtyRowKeys(viewIds, entities, prevSigs, viewIds);
    expect(dirty).toEqual(['torrents:2']);
  });

  test('viewIdIndexMap resolves row index in O(1)', () => {
    const viewIds = ['torrents:1', 'torrents:2', 'torrents:3'];
    const indexMap = buildViewIdIndexMap(viewIds);
    expect(indexMap.get('torrents:2')).toBe(1);
    expect(indexMap.get('torrents:missing')).toBeUndefined();
  });
});

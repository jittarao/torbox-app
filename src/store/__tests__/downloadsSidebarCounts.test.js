import { describe, expect, test } from 'bun:test';
import {
  countDownloadsPerTagFromStore,
  countDownloadsPerViewFromStore,
} from '../downloadsDerivedSelectors.js';
import { entityKey } from '@/utils/downloadListMerge.js';
import { EMPTY_FILTERS } from '@/components/downloads/filters/filterHelpers.js';

describe('sidebar count selectors', () => {
  const torboxState = {
    entities: {
      [entityKey('torrents', 1)]: { id: 1, assetType: 'torrents', name: 'A' },
      [entityKey('torrents', 2)]: { id: 2, assetType: 'torrents', name: 'B' },
    },
    order: {
      torrents: [entityKey('torrents', 1), entityKey('torrents', 2)],
      usenet: [],
      webdl: [],
    },
  };

  test('countDownloadsPerTagFromStore', () => {
    const counts = countDownloadsPerTagFromStore(torboxState, 'torrents', {
      1: [{ id: 10, name: 'Tag' }],
      2: [
        { id: 10, name: 'Tag' },
        { id: 11, name: 'Other' },
      ],
    });
    expect(counts[10]).toBe(2);
    expect(counts[11]).toBe(1);
  });

  test('countDownloadsPerViewFromStore returns zero for empty filters on all tab', () => {
    const counts = countDownloadsPerViewFromStore(
      [{ id: 1, filters: EMPTY_FILTERS, asset_type: 'all' }],
      torboxState,
      'torrents',
      {},
      []
    );
    expect(counts[1]).toBe(0);
  });
});

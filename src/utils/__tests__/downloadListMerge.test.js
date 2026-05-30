import { describe, expect, test } from 'bun:test';
import {
  mergeDownloadList,
  mergeListIntoEntities,
  entityKey,
  downloadRowEqual,
  sortItemsNonMutating,
  downloadListIdSignature,
  downloadListReconcileSignature,
  itemsReconcileStructureUnchanged,
  isRowLikelyChanging,
} from '../downloadListMerge.js';

describe('sortItemsNonMutating', () => {
  test('does not mutate input', () => {
    const input = [{ id: 1, added: '2020-01-02' }, { id: 2, added: '2020-01-03' }];
    const sorted = sortItemsNonMutating(input);
    expect(input[0].id).toBe(1);
    expect(sorted[0].id).toBe(2);
  });
});

describe('mergeDownloadList', () => {
  test('full snapshot tags assetType and sorts by added desc', () => {
    const result = mergeDownloadList(
      [],
      {
        data: [
          { id: 1, added: '2020-01-01', download_finished: true, active: false },
          { id: 2, added: '2020-01-03', download_finished: true, active: false },
        ],
      },
      'torrents'
    );
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(2);
    expect(result[0].assetType).toBe('torrents');
  });

  test('delta merge removes and updates rows', () => {
    const prev = [
      { id: 1, added: '2020-01-01', assetType: 'torrents', download_finished: true, active: false },
      { id: 2, added: '2020-01-02', assetType: 'torrents', download_finished: true, active: false },
    ];
    const result = mergeDownloadList(
      prev,
      {
        delta: true,
        removed: [2],
        data: [{ id: 3, added: '2020-01-03', download_finished: true, active: false }],
      },
      'torrents'
    );
    expect(result.map((r) => r.id)).toEqual([3, 1]);
  });

  test('reuses row reference when data unchanged for completed item', () => {
    const prev = [
      {
        id: 1,
        added: '2020-01-01',
        assetType: 'torrents',
        download_finished: true,
        active: false,
        progress: 1,
        name: 'done',
      },
    ];
    const result = mergeDownloadList(
      prev,
      {
        delta: true,
        data: [
          {
            id: 1,
            added: '2020-01-01',
            download_finished: true,
            active: false,
            progress: 1,
            name: 'done',
          },
        ],
      },
      'torrents'
    );
    expect(result[0]).toBe(prev[0]);
  });

  test('new reference when active row progress changes', () => {
    const prev = [
      {
        id: 1,
        added: '2020-01-01',
        assetType: 'torrents',
        download_finished: false,
        active: true,
        progress: 0.5,
      },
    ];
    const result = mergeDownloadList(
      prev,
      {
        delta: true,
        data: [
          {
            id: 1,
            added: '2020-01-01',
            download_finished: false,
            active: true,
            progress: 0.6,
          },
        ],
      },
      'torrents'
    );
    expect(result[0]).not.toBe(prev[0]);
    expect(result[0].progress).toBe(0.6);
  });
});

describe('downloadRowEqual', () => {
  test('returns true for active rows when compared fields are unchanged', () => {
    const row = { id: 1, assetType: 'torrents', active: true, download_finished: false };
    expect(isRowLikelyChanging(row)).toBe(true);
    expect(downloadRowEqual(row, { ...row })).toBe(true);
  });

  test('returns false when progress changes on an active row', () => {
    const prev = { id: 1, assetType: 'torrents', active: true, progress: 0.5 };
    const next = { ...prev, progress: 0.6 };
    expect(downloadRowEqual(prev, next)).toBe(false);
  });
});

describe('downloadListIdSignature', () => {
  test('is stable across array reference changes', () => {
    const a = [
      { id: 2, assetType: 'usenet' },
      { id: 1, assetType: 'torrents' },
    ];
    const b = [
      { id: 1, assetType: 'torrents' },
      { id: 2, assetType: 'usenet' },
    ];
    expect(downloadListIdSignature(a)).toBe(downloadListIdSignature(b));
  });
});

describe('mergeListIntoEntities', () => {
  test('builds entity map and order keys', () => {
    const row = {
      id: 1,
      assetType: 'torrents',
      added: '2020-01-01',
      download_finished: true,
      active: false,
    };
    const { entities, orderKeys } = mergeListIntoEntities({}, [], [row], 'torrents');
    expect(orderKeys).toEqual([entityKey('torrents', 1)]);
    expect(entities[entityKey('torrents', 1)]).toBe(row);
  });
});

describe('downloadListReconcileSignature', () => {
  test('changes when file list changes for the same item id', () => {
    const withoutFiles = [{ id: 1, assetType: 'torrents' }];
    const withFiles = [{ id: 1, assetType: 'torrents', files: [{ id: 10, size: 100 }] }];
    expect(downloadListReconcileSignature(withoutFiles)).not.toBe(
      downloadListReconcileSignature(withFiles)
    );
  });
});

describe('itemsReconcileStructureUnchanged', () => {
  const row = { id: 1, assetType: 'torrents' };

  test('returns true for new array with same row references', () => {
    const prev = [row];
    expect(itemsReconcileStructureUnchanged(prev, [...prev])).toBe(true);
  });

  test('returns false when a row reference changes', () => {
    expect(
      itemsReconcileStructureUnchanged([row], [{ ...row, progress: 50 }])
    ).toBe(false);
  });

  test('returns false when list length changes', () => {
    expect(itemsReconcileStructureUnchanged([row], [row, row])).toBe(false);
  });
});

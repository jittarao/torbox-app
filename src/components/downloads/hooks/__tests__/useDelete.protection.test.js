import '../../../../../test-setup-dom.js';
import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';

let batchDeleteCalls = [];
let toastMessages = [];

mock.module('next-intl', () => ({
  useTranslations: () => (key, values) => {
    if (key === 'protectedSkipped') return `${values.count} skipped`;
    if (key === 'deletePartialSuccess') {
      return `Deleted ${values.count}/${values.total}`;
    }
    return key;
  },
}));

mock.module('@/utils/deleteHelpers', () => ({
  deleteItemHelper: mock(() => Promise.resolve({ success: true })),
  batchDeleteHelper: mock((ids) => {
    batchDeleteCalls.push(ids);
    return Promise.resolve(ids);
  }),
}));

mock.module('@/store/torboxDownloadsStore', () => {
  let patchItemImpl = () => {};
  const state = {
    removeByIds: () => {},
    patchItem: (...args) => patchItemImpl(...args),
  };
  const hook = (selector) => (typeof selector === 'function' ? selector(state) : state);
  hook.getState = () => state;
  return {
    useTorboxDownloadsStore: hook,
    __setPatchItemImpl: (fn) => {
      patchItemImpl = fn;
    },
  };
});

const { useDelete } = await import('../useDelete.js');

describe('useDelete protection', () => {
  beforeEach(() => {
    batchDeleteCalls = [];
    toastMessages = [];
  });

  test('deleteItems skips protected downloads and shows partial success toast', async () => {
    const setToast = (toast) => {
      toastMessages.push(toast);
    };

    const { result } = renderHook(() =>
      useDelete(
        'api-key',
        () => {},
        setToast,
        () => {},
        'torrents'
      )
    );

    const items = [
      { id: 1, is_protected: true, assetType: 'torrents' },
      { id: 2, is_protected: false, assetType: 'torrents' },
      { id: 3, is_protected: false, assetType: 'torrents' },
    ];

    await act(async () => {
      await result.current.deleteItems(
        {
          items: new Set(['torrents:1', 'torrents:2', 'torrents:3']),
          files: new Map(),
        },
        false,
        items
      );
    });

    expect(batchDeleteCalls).toEqual([[2, 3]]);
    expect(toastMessages[0]).toMatchObject({
      type: 'warning',
      message: 'Deleted 2/3 1 skipped',
    });
  });

  test('deleteItems shows blocked toast when all selected items are protected', async () => {
    const setToast = (toast) => {
      toastMessages.push(toast);
    };

    const { result } = renderHook(() =>
      useDelete(
        'api-key',
        () => {},
        setToast,
        () => {},
        'torrents'
      )
    );

    const items = [
      { id: 1, is_protected: true, assetType: 'torrents' },
      { id: 2, is_protected: true, assetType: 'torrents' },
    ];

    await act(async () => {
      await result.current.deleteItems(
        {
          items: new Set(['torrents:1', 'torrents:2']),
          files: new Map(),
        },
        false,
        items
      );
    });

    expect(batchDeleteCalls).toEqual([]);
    expect(toastMessages[0]).toMatchObject({
      type: 'error',
      message: 'protectedBlocked',
    });
  });
});

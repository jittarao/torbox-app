import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const mockSelectionState = {
  selectedItems: { items: new Set(), files: new Map() },
};

const mockUiContext = { isBackendAvailable: false };

mock.module('next-intl', () => ({
  useTranslations: (scope) => (key, params) => {
    let str = scope ? `${scope}.${key}` : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  },
}));

mock.module('../DownloadsUIContext', () => ({
  useDownloadsUIContext: () => mockUiContext,
}));

mock.module('../DownloadsContext', () => ({
  useDownloadsContext: () => ({
    stopSeedingItems: async () => ({ successCount: 0, skippedCount: 0 }),
    isStoppingSeeding: false,
    protectItems: async () => ({ success: true }),
    unprotectItems: async () => ({ success: true }),
    isUpdatingProtection: false,
  }),
}));

mock.module('@/store/downloadsSelectionStore', () => {
  const store = (selector) => selector(mockSelectionState);
  store.getState = () => mockSelectionState;
  store.selectSelectedItemCount = (s) => s.selectedItems.items.size;
  return {
    useDownloadsSelectionStore: store,
    selectSelectedItemCount: store.selectSelectedItemCount,
  };
});

let __setPatchItemImpl = () => {};

mock.module('@/store/torboxDownloadsStore', () => {
  let patchItemImpl = () => {};
  const setPatchItemImpl = (fn) => {
    patchItemImpl = fn;
  };
  __setPatchItemImpl = setPatchItemImpl;
  return {
    useTorboxDownloadsStore: (selector) =>
      selector({
        patchItem: (...args) => patchItemImpl(...args),
      }),
    __setPatchItemImpl: setPatchItemImpl,
  };
});

mock.module('@/store/torboxDownloadsSelectors', () => ({
  resolveItemAssetType: (item, activeType) => (activeType === 'all' ? item.assetType : activeType),
}));

mock.module('@/utils/downloadSelectionId', () => ({
  findItemBySelectionId: (allItems, selectionId) =>
    allItems.find((item) => String(item.id) === selectionId),
  getDownloadSelectionId: (item) => {
    if (!item) return '';
    const assetType = item.assetType || item.asset_type || 'torrents';
    return `${assetType}:${item.id}`;
  },
}));

mock.module('@/utils/utility', () => ({
  isQueuedItem: (item) => item.download_state === 'is queued' || item.queued === true,
}));

mock.module('@/utils/uploadActions', () => ({
  controlQueuedItem: () => Promise.resolve({ success: true }),
  controlTorrent: () => Promise.resolve({ success: true }),
}));

mock.module('@/utils/retryDownload', () => ({
  canRetryDownload: () => false,
  retryDownload: () => Promise.resolve({ success: true }),
}));

mock.module('@/store/downloadListReconcile', () => ({
  removeQueuedAfterForceStartBulk: () => {},
}));

mock.module('@/utils/sa', () => ({
  phEvent: () => {},
}));

mock.module('@/utils/apiClient', () => ({
  createApiClient: () => ({ getIntegrationJobs: () => Promise.resolve({ jobs: [] }) }),
}));

mock.module('@/components/shared/Tooltip', () => ({
  __esModule: true,
  default: ({ children }) => children ?? null,
}));

mock.module('@/components/shared/ModalSheet', () => ({
  __esModule: true,
  default: ({ children, open }) => (open ? (children ?? null) : null),
}));

mock.module('@/hooks/useIsMobile', () => ({
  __esModule: true,
  default: () => false,
}));

mock.module('../../Tags/TagAssignmentModal', () => ({
  __esModule: true,
  default: () => null,
}));

const mockFetch = mock(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
);
const originalFetch = globalThis.fetch;
globalThis.fetch = mockFetch;

const { default: ActionButtons } = await import('../ActionBar/components/ActionButtons');

function renderButtons({ allItems, activeType = 'torrents' } = {}) {
  return render(
    <ActionButtons
      setSelectedItems={() => {}}
      hasSelectedFiles={false}
      bulkProgress={{
        downloading: false,
        deleting: false,
        exporting: false,
        archiving: false,
      }}
      onBulkDownload={() => {}}
      onBulkDelete={() => {}}
      onBulkArchive={() => {}}
      onBulkExport={() => {}}
      itemTypeName="item"
      itemTypePlural="items"
      downloadPanel={{ open: false, setOpen: () => {} }}
      activeType={activeType}
      apiKey="test-key"
      setToast={() => {}}
      allItems={allItems}
    />
  );
}

describe('ActionButtons bulk Airlock', () => {
  beforeEach(() => {
    mockSelectionState.selectedItems = { items: new Set(), files: new Map() };
    mockUiContext.isBackendAvailable = false;
    __setPatchItemImpl(() => {});
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    );
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    globalThis.fetch = originalFetch;
  });

  it('shows Lock when all selected rows are unlocked', () => {
    const allItems = [
      { id: 1, airlocked: false, download_state: 'completed' },
      { id: 2, airlocked: false, download_state: 'completed' },
    ];
    mockSelectionState.selectedItems.items = new Set(['1', '2']);

    renderButtons({ allItems });

    expect(screen.getByText('ActionButtons.bulkAirlockLock')).toBeTruthy();
    expect(screen.queryByText('ActionButtons.bulkAirlockUnlock')).toBeNull();
  });

  it('shows Unlock when all selected rows are locked', () => {
    const allItems = [
      { id: 1, airlocked: true, download_state: 'completed' },
      { id: 2, airlocked: true, download_state: 'completed' },
    ];
    mockSelectionState.selectedItems.items = new Set(['1', '2']);

    renderButtons({ allItems });

    expect(screen.getByText('ActionButtons.bulkAirlockUnlock')).toBeTruthy();
    expect(screen.queryByText('ActionButtons.bulkAirlockLock')).toBeNull();
  });

  it('shows neither Lock nor Unlock for mixed lock state', () => {
    const allItems = [
      { id: 1, airlocked: false, download_state: 'completed' },
      { id: 2, airlocked: true, download_state: 'completed' },
    ];
    mockSelectionState.selectedItems.items = new Set(['1', '2']);

    renderButtons({ allItems });

    expect(screen.queryByText('ActionButtons.bulkAirlockLock')).toBeNull();
    expect(screen.queryByText('ActionButtons.bulkAirlockUnlock')).toBeNull();
  });

  it('does not expose bulk Airlock for queued rows', () => {
    const allItems = [{ id: 1, airlocked: false, download_state: 'is queued' }];
    mockSelectionState.selectedItems.items = new Set(['1']);

    renderButtons({ allItems });

    expect(screen.queryByText('ActionButtons.bulkAirlockLock')).toBeNull();
    expect(screen.queryByText('ActionButtons.bulkAirlockUnlock')).toBeNull();
  });

  it('calls airlock endpoint when Lock is clicked', async () => {
    const allItems = [{ id: 1, airlocked: false, download_state: 'completed' }];
    mockSelectionState.selectedItems.items = new Set(['1']);

    renderButtons({ allItems });

    fireEvent.click(screen.getByText('ActionButtons.bulkAirlockLock'));

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    const opts = call[1];
    expect(opts.method).toBe('PUT');
    expect(opts.headers['x-api-key']).toBe('test-key');
    const body = JSON.parse(opts.body);
    expect(body.airlocked).toBe(true);
    expect(body.id).toBe(1);
  });

  it('keeps Locking label during bulk lock despite optimistic airlocked patch', async () => {
    const initialItems = [{ id: 1, airlocked: false, download_state: 'completed' }];
    mockSelectionState.selectedItems.items = new Set(['1']);

    let resolveFetch;
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
        })
    );

    function OptimisticList() {
      const [items, setItems] = useState(initialItems);
      __setPatchItemImpl((_uiAssetType, id, patch) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
      });

      return (
        <ActionButtons
          setSelectedItems={() => {}}
          hasSelectedFiles={false}
          bulkProgress={{
            downloading: false,
            deleting: false,
            exporting: false,
            archiving: false,
          }}
          onBulkDownload={() => {}}
          onBulkDelete={() => {}}
          onBulkArchive={() => {}}
          onBulkExport={() => {}}
          itemTypeName="item"
          itemTypePlural="items"
          downloadPanel={{ open: false, setOpen: () => {} }}
          activeType="torrents"
          apiKey="test-key"
          setToast={() => {}}
          allItems={items}
        />
      );
    }

    render(<OptimisticList />);

    fireEvent.click(screen.getByText('ActionButtons.bulkAirlockLock'));

    await waitFor(() => {
      expect(screen.getByText('ActionButtons.bulkAirlockLocking')).toBeTruthy();
    });
    expect(screen.queryByText('ActionButtons.bulkAirlockUnlocking')).toBeNull();

    resolveFetch();
    await waitFor(() => {
      expect(screen.queryByText('ActionButtons.bulkAirlockLocking')).toBeNull();
    });
  });

  it('runs bulk Lock with a bounded rolling pool (max 3 in flight)', async () => {
    const count = 10;
    const allItems = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      airlocked: false,
      download_state: 'completed',
    }));
    mockSelectionState.selectedItems.items = new Set(allItems.map((item) => String(item.id)));

    let inFlight = 0;
    let maxInFlight = 0;
    mockFetch.mockImplementation(() => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return Bun.sleep(15).then(() => {
        inFlight--;
        return { ok: true, json: () => Promise.resolve({ success: true }) };
      });
    });

    renderButtons({ allItems });

    fireEvent.click(screen.getByText('ActionButtons.bulkAirlockLock'));

    // 10 requests @ ~15ms each, 3-wide → ~5 waves; allow headroom.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(count));

    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('skips lock requests for files >= the smallest failed size (Airlock limit)', async () => {
    // Concurrency is 3. The 500GB file fails fast and sets the failed-size
    // threshold; the 1TB file (pulled next by the freed worker) is >= 500GB and
    // is skipped without an API call. Smaller files are still attempted.
    const GB = 1e9;
    const allItems = [
      { id: 1, size: 100 * GB, airlocked: false, download_state: 'completed' },
      { id: 2, size: 500 * GB, airlocked: false, download_state: 'completed' },
      { id: 3, size: 50 * GB, airlocked: false, download_state: 'completed' },
      { id: 4, size: 1000 * GB, airlocked: false, download_state: 'completed' },
    ];
    mockSelectionState.selectedItems.items = new Set(['1', '2', '3', '4']);

    const fetchedIds = [];
    mockFetch.mockImplementation((_url, opts) => {
      const body = JSON.parse(opts.body);
      fetchedIds.push(body.id);
      if (body.id === 2) {
        return Promise.resolve({
          ok: false,
          status: 422,
          json: () =>
            Promise.resolve({
              success: false,
              error: 'AIRLOCK_LIMIT_REACHED',
              detail: 'limit reached',
            }),
        });
      }
      return Bun.sleep(30).then(() => ({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }));
    });

    renderButtons({ allItems });
    fireEvent.click(screen.getByText('ActionButtons.bulkAirlockLock'));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));

    // 1TB (id 4) must NOT have been fetched — it is >= the 500GB threshold.
    expect(fetchedIds).not.toContain(4);
    expect(fetchedIds).toContain(1);
    expect(fetchedIds).toContain(2);
    expect(fetchedIds).toContain(3);
  });

  it('never skips unlock requests even when a limit error occurs', async () => {
    // Unlock frees space, so the size-threshold inference must not apply: even
    // after a limit-reached "failure", a larger file is still attempted.
    const GB = 1e9;
    const allItems = [
      { id: 1, size: 100 * GB, airlocked: true, download_state: 'completed' },
      { id: 2, size: 50 * GB, airlocked: true, download_state: 'completed' },
      { id: 3, size: 50 * GB, airlocked: true, download_state: 'completed' },
      { id: 4, size: 1000 * GB, airlocked: true, download_state: 'completed' },
    ];
    mockSelectionState.selectedItems.items = new Set(['1', '2', '3', '4']);

    const fetchedIds = [];
    mockFetch.mockImplementation((_url, opts) => {
      const body = JSON.parse(opts.body);
      fetchedIds.push(body.id);
      if (body.id === 1) {
        return Promise.resolve({
          ok: false,
          status: 422,
          json: () =>
            Promise.resolve({
              success: false,
              error: 'AIRLOCK_LIMIT_REACHED',
              detail: 'limit reached',
            }),
        });
      }
      return Bun.sleep(30).then(() => ({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }));
    });

    renderButtons({ allItems });
    fireEvent.click(screen.getByText('ActionButtons.bulkAirlockUnlock'));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));

    // Every file was attempted, including the 1TB file.
    expect(fetchedIds).toContain(4);
  });
});

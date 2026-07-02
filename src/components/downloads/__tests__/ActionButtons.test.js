import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import React from 'react';
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

mock.module('@/store/downloadsSelectionStore', () => {
  const store = (selector) => selector(mockSelectionState);
  store.getState = () => mockSelectionState;
  store.selectSelectedItemCount = (s) => s.selectedItems.items.size;
  return {
    useDownloadsSelectionStore: store,
    selectSelectedItemCount: store.selectSelectedItemCount,
  };
});

mock.module('@/store/torboxDownloadsStore', () => ({
  useTorboxDownloadsStore: (selector) =>
    selector({
      patchItem: () => {},
    }),
}));

mock.module('@/store/torboxDownloadsSelectors', () => ({
  resolveItemAssetType: (item, activeType) => (activeType === 'all' ? item.assetType : activeType),
}));

mock.module('@/utils/downloadSelectionId', () => ({
  findItemBySelectionId: (allItems, selectionId) =>
    allItems.find((item) => String(item.id) === selectionId),
}));

mock.module('@/utils/utility', () => ({
  isQueuedItem: (item) => item.download_state === 'is queued' || item.queued === true,
}));

mock.module('@/store/torboxDownloadsFetch', () => ({
  fetchDownloadType: () => Promise.resolve([]),
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
globalThis.fetch = mockFetch;

const { default: ActionButtons } = await import('../ActionBar/components/ActionButtons');

function renderButtons({ allItems, activeType = 'torrents' } = {}) {
  return render(
    <ActionButtons
      setSelectedItems={() => {}}
      hasSelectedFiles={false}
      isDownloading={false}
      isDeleting={false}
      isExporting={false}
      onBulkDownload={() => {}}
      onBulkDelete={() => {}}
      onBulkArchive={() => {}}
      onBulkExport={() => {}}
      itemTypeName="item"
      itemTypePlural="items"
      isDownloadPanelOpen={false}
      setIsDownloadPanelOpen={() => {}}
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
    mockFetch.mockReset();
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
    );
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
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
});

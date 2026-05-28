import { describe, expect, test, beforeEach } from 'bun:test';
import {
  emptySelection,
  loadStoredSelections,
  pruneSelectionAgainstItems,
  useDownloadsSelectionStore,
} from '../downloadsSelectionStore.js';

function mockLocalStorage() {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };
  return storage;
}

describe('downloadsSelectionStore', () => {
  beforeEach(() => {
    mockLocalStorage();
    useDownloadsSelectionStore.setState({
      activeType: 'all',
      selectedItems: emptySelection(),
      listSignature: '',
      hasHydratedSelection: false,
    });
  });

  test('loadStoredSelections reads per-tab keys', () => {
    localStorage.setItem(
      'torboxSelectedItems:torrents',
      JSON.stringify({ items: ['torrents:1'], files: {} })
    );

    const loaded = loadStoredSelections('torrents', []);
    expect(Array.from(loaded.items)).toEqual(['torrents:1']);
  });

  test('setActiveType hydrates on first mount even when type unchanged', () => {
    localStorage.setItem(
      'torboxSelectedItems:all',
      JSON.stringify({ items: ['torrents:42'], files: {} })
    );

    useDownloadsSelectionStore.getState().setActiveType('all');
    expect(Array.from(useDownloadsSelectionStore.getState().selectedItems.items)).toEqual([
      'torrents:42',
    ]);
    expect(useDownloadsSelectionStore.getState().hasHydratedSelection).toBe(true);
  });

  test('pruneSelectionAgainstItems drops stale ids', () => {
    const selection = {
      items: new Set(['torrents:1', 'torrents:99']),
      files: new Map(),
    };
    const items = [{ id: 1, assetType: 'torrents' }];

    const pruned = pruneSelectionAgainstItems(selection, items);
    expect(Array.from(pruned.items)).toEqual(['torrents:1']);
  });

  test('reconcileWithItems prunes when list signature changes', () => {
    localStorage.setItem(
      'torboxSelectedItems:all',
      JSON.stringify({ items: ['torrents:1', 'torrents:99'], files: {} })
    );
    useDownloadsSelectionStore.setState({
      activeType: 'all',
      selectedItems: emptySelection(),
      listSignature: '',
      hasHydratedSelection: true,
    });

    useDownloadsSelectionStore.getState().reconcileWithItems([{ id: 1, assetType: 'torrents' }]);
    expect(Array.from(useDownloadsSelectionStore.getState().selectedItems.items)).toEqual([
      'torrents:1',
    ]);
  });
});

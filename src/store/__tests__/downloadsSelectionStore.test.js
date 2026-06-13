import { describe, expect, test, beforeEach } from 'bun:test';
import {
  apiKeyStorageScope,
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

const KEY_A = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const KEY_B = 'bbbbbbbb-bbbb-cccc-dddd-ffffffffffff';

describe('downloadsSelectionStore', () => {
  beforeEach(() => {
    mockLocalStorage();
    useDownloadsSelectionStore.setState({
      activeType: 'all',
      apiKeyScope: '',
      selectedItems: emptySelection(),
      listSignature: '',
      hasHydratedSelection: false,
    });
  });

  test('loadStoredSelections reads per-tab keys scoped to api key', () => {
    const scope = apiKeyStorageScope(KEY_A);
    localStorage.setItem(
      `torboxSelectedItems:${scope}:torrents`,
      JSON.stringify({ items: ['torrents:1'], files: {} })
    );

    const loaded = loadStoredSelections('torrents', [], scope);
    expect(Array.from(loaded.items)).toEqual(['torrents:1']);
  });

  test('setActiveType hydrates on first mount even when type unchanged', () => {
    const scope = apiKeyStorageScope(KEY_A);
    useDownloadsSelectionStore.setState({ apiKeyScope: scope });
    localStorage.setItem(
      `torboxSelectedItems:${scope}:all`,
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

  test('reconcileWithItems prunes in-memory selection when list changes', () => {
    useDownloadsSelectionStore.setState({
      activeType: 'all',
      apiKeyScope: apiKeyStorageScope(KEY_A),
      selectedItems: {
        items: new Set(['torrents:1', 'torrents:99']),
        files: new Map(),
      },
      listSignature: '',
      hasHydratedSelection: true,
    });

    useDownloadsSelectionStore.getState().reconcileWithItems([{ id: 1, assetType: 'torrents' }]);
    expect(Array.from(useDownloadsSelectionStore.getState().selectedItems.items)).toEqual([
      'torrents:1',
    ]);
  });

  test('reconcileWithItems prunes stale file ids when file list appears', () => {
    useDownloadsSelectionStore.setState({
      activeType: 'all',
      apiKeyScope: apiKeyStorageScope(KEY_A),
      selectedItems: {
        items: new Set(),
        files: new Map([['torrents:1', new Set([99, 100])]]),
      },
      listSignature: '',
      hasHydratedSelection: true,
    });

    useDownloadsSelectionStore
      .getState()
      .reconcileWithItems([{ id: 1, assetType: 'torrents', files: [{ id: 100, size: 1 }] }]);

    const files = useDownloadsSelectionStore.getState().selectedItems.files.get('torrents:1');
    expect(files ? Array.from(files) : []).toEqual([100]);
  });

  test('resetForApiKey clears selection when api key changes', () => {
    const scopeA = apiKeyStorageScope(KEY_A);
    useDownloadsSelectionStore.setState({
      apiKeyScope: scopeA,
      selectedItems: { items: new Set(['torrents:1']), files: new Map() },
      hasHydratedSelection: true,
    });

    useDownloadsSelectionStore.getState().resetForApiKey(KEY_B);

    expect(useDownloadsSelectionStore.getState().selectedItems.items.size).toBe(0);
    expect(useDownloadsSelectionStore.getState().apiKeyScope).toBe(apiKeyStorageScope(KEY_B));
    expect(useDownloadsSelectionStore.getState().hasHydratedSelection).toBe(false);
  });
});

import { create } from 'zustand';
import { downloadListReconcileSignature } from '@/utils/downloadListMerge';
import { getDownloadSelectionId, selectionIdMatchesItem } from '@/utils/downloadSelectionId';
import { getItem, setItem } from '@/utils/storage';

const LEGACY_STORAGE_KEY = 'torboxSelectedItems';

/** Stable localStorage namespace per API key (not reversible to full key). */
export function apiKeyStorageScope(apiKey) {
  if (!apiKey || apiKey.length < 8) return '';
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    hash = (Math.imul(31, hash) + apiKey.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function storageKeyForType(activeType, apiKeyScope) {
  const type = activeType || 'all';
  if (apiKeyScope) {
    return `torboxSelectedItems:${apiKeyScope}:${type}`;
  }
  return `torboxSelectedItems:${type}`;
}

function parseFileMapKey(key) {
  if (typeof key === 'string' && key.includes(':')) {
    return key;
  }
  const numeric = parseInt(key, 10);
  return Number.isNaN(numeric) ? key : numeric;
}

export function emptySelection() {
  return { items: new Set(), files: new Map() };
}

function serializeSelection({ items, files }) {
  return JSON.stringify({
    items: Array.from(items),
    files: Object.fromEntries(
      Array.from(files).map(([key, value]) => [key, Array.from(value)])
    ),
  });
}

function deserializeSelection(raw) {
  if (!raw) return emptySelection();

  try {
    const { items: storedItems, files: storedFiles } = JSON.parse(raw);
    return {
      items: new Set(Array.isArray(storedItems) ? storedItems : []),
      files: new Map(
        Object.entries(storedFiles && typeof storedFiles === 'object' ? storedFiles : {}).map(
          ([key, value]) => [parseFileMapKey(key), new Set(Array.isArray(value) ? value : [])]
        )
      ),
    };
  } catch {
    return emptySelection();
  }
}

function persistSelection(activeType, selection, apiKeyScope = '') {
  try {
    setItem(storageKeyForType(activeType, apiKeyScope), serializeSelection(selection));
  } catch (error) {
    console.error('Error saving selections to localStorage:', error);
  }
}

function readRawSelection(activeType, apiKeyScope = '') {
  const scoped = getItem(storageKeyForType(activeType, apiKeyScope));
  if (scoped) return scoped;

  const unscoped = getItem(storageKeyForType(activeType, ''));
  if (unscoped) return unscoped;

  if (activeType === 'all') {
    return getItem(LEGACY_STORAGE_KEY);
  }

  return null;
}

export function pruneSelectionAgainstItems(selection, currentItems) {
  if (!currentItems?.length) {
    return selection;
  }

  const itemsBySelectionId = new Map();
  for (const item of currentItems) {
    itemsBySelectionId.set(getDownloadSelectionId(item), item);
  }

  const validItems = new Set(
    Array.from(selection.items).filter(
      (storedId) =>
        itemsBySelectionId.has(storedId) ||
        currentItems.some((item) => selectionIdMatchesItem(storedId, item))
    )
  );

  const validFiles = new Map();
  for (const [itemKey, fileIds] of selection.files) {
    const mapKey = parseFileMapKey(itemKey);
    let item = itemsBySelectionId.get(mapKey) ?? itemsBySelectionId.get(String(mapKey));
    if (!item) {
      item = currentItems.find((i) => selectionIdMatchesItem(mapKey, i));
    }

    if (item && (!item.files || !item.files.length)) {
      validFiles.set(getDownloadSelectionId(item), new Set(fileIds));
      continue;
    }

    if (!item) continue;

    const fileIdSet = new Set(item.files?.map((f) => f.id) ?? []);
    const validFileIds = new Set(
      Array.from(fileIds).filter((fileId) => fileIdSet.has(fileId))
    );

    if (validFileIds.size > 0) {
      validFiles.set(getDownloadSelectionId(item), validFileIds);
    }
  }

  return { items: validItems, files: validFiles };
}

export function loadStoredSelections(activeType, currentItems = [], apiKeyScope = '') {
  const raw = readRawSelection(activeType, apiKeyScope);
  const parsed = deserializeSelection(raw);

  if (!currentItems.length) {
    return parsed;
  }

  return pruneSelectionAgainstItems(parsed, currentItems);
}

export const useDownloadsSelectionStore = create((set, get) => ({
  activeType: 'all',
  apiKeyScope: '',
  selectedItems: emptySelection(),
  listSignature: '',
  hasHydratedSelection: false,

  setApiKeyScope: (apiKey) => {
    const scope = apiKeyStorageScope(apiKey);
    const { apiKeyScope: prevScope } = get();
    if (prevScope === scope) return;
    get().resetForApiKey(apiKey);
  },

  resetForApiKey: (apiKey) => {
    const scope = apiKeyStorageScope(apiKey);
    const { apiKeyScope: prevScope, activeType, selectedItems } = get();

    if (prevScope && prevScope !== scope) {
      persistSelection(activeType, selectedItems, prevScope);
    }

    set({
      apiKeyScope: scope,
      selectedItems: emptySelection(),
      listSignature: '',
      hasHydratedSelection: false,
    });
  },

  setActiveType: (activeType) => {
    const { activeType: prevType, selectedItems, hasHydratedSelection, apiKeyScope } = get();
    if (prevType === activeType && hasHydratedSelection) return;

    if (prevType !== activeType) {
      persistSelection(prevType, selectedItems, apiKeyScope);
    }

    const nextSelection = loadStoredSelections(activeType, [], apiKeyScope);
    set({
      activeType,
      selectedItems: nextSelection,
      listSignature: '',
      hasHydratedSelection: true,
    });
  },

  setSelectedItems: (updaterOrValue) => {
    set((state) => {
      const next =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(state.selectedItems)
          : {
              items: updaterOrValue.items ?? state.selectedItems.items,
              files: updaterOrValue.files ?? state.selectedItems.files,
            };

      persistSelection(state.activeType, next, state.apiKeyScope);
      return { selectedItems: next };
    });
  },

  clearSelection: () => {
    const { activeType, apiKeyScope } = get();
    const empty = emptySelection();
    persistSelection(activeType, empty, apiKeyScope);
    set({ selectedItems: empty });
  },

  reconcileWithItems: (items, signature) => {
    const nextSignature =
      signature !== undefined ? signature : downloadListReconcileSignature(items);
    const { listSignature, selectedItems, activeType, apiKeyScope } = get();
    if (listSignature === nextSignature) return;

    const pruned = pruneSelectionAgainstItems(selectedItems, items || []);
    persistSelection(activeType, pruned, apiKeyScope);
    set({ listSignature: nextSignature, selectedItems: pruned });
  },

  handleSelectAll: (items, checked) => {
    get().setSelectedItems({
      items: checked ? new Set(items.map((t) => getDownloadSelectionId(t))) : new Set(),
      files: new Map(),
    });
  },

  handleFileSelect: (selectionId, fileId, checked) => {
    get().setSelectedItems((prev) => {
      const newFiles = new Map(prev.files);
      if (!newFiles.has(selectionId)) {
        newFiles.set(selectionId, new Set());
      }

      if (checked) {
        newFiles.get(selectionId).add(fileId);
      } else {
        newFiles.get(selectionId).delete(fileId);
        if (newFiles.get(selectionId).size === 0) {
          newFiles.delete(selectionId);
        }
      }

      return {
        items: prev.items,
        files: newFiles,
      };
    });
  },

  removeSelectionIds: (selectionIds) => {
    const idSet = selectionIds instanceof Set ? selectionIds : new Set(selectionIds);
    get().setSelectedItems((prev) => ({
      items: new Set([...prev.items].filter((id) => !idSet.has(id))),
      files: new Map([...prev.files].filter(([selectionId]) => !idSet.has(selectionId))),
    }));
  },
}));

/** @param {string|number} selectionId */
export function selectIsItemSelected(selectionId) {
  return (state) => state.selectedItems.items.has(selectionId);
}

export function selectSelectedItemCount(state) {
  return state.selectedItems.items.size;
}

export function selectTotalSelectedFileCount(state) {
  return Array.from(state.selectedItems.files.values()).reduce(
    (total, files) => total + files.size,
    0
  );
}

export function selectHasSelectedFiles(state) {
  return Array.from(state.selectedItems.files.values()).some((files) => files.size > 0);
}

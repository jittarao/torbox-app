import { create } from 'zustand';
import { downloadListIdSignature } from '@/utils/downloadListMerge';
import {
  getDownloadSelectionId,
  selectionIdMatchesItem,
} from '@/utils/downloadSelectionId';

const LEGACY_STORAGE_KEY = 'torboxSelectedItems';

function storageKeyForType(activeType) {
  return `torboxSelectedItems:${activeType || 'all'}`;
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

function persistSelection(activeType, selection) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKeyForType(activeType), serializeSelection(selection));
  } catch (error) {
    console.error('Error saving selections to localStorage:', error);
  }
}

function readRawSelection(activeType) {
  if (typeof localStorage === 'undefined') return null;

  const scoped = localStorage.getItem(storageKeyForType(activeType));
  if (scoped) return scoped;

  if (activeType === 'all') {
    return localStorage.getItem(LEGACY_STORAGE_KEY);
  }

  return null;
}

export function pruneSelectionAgainstItems(selection, currentItems) {
  if (!currentItems?.length) {
    return selection;
  }

  const validItems = new Set(
    Array.from(selection.items).filter((storedId) =>
      currentItems.some((item) => selectionIdMatchesItem(storedId, item))
    )
  );

  const validFiles = new Map();
  for (const [itemKey, fileIds] of selection.files) {
    const mapKey = parseFileMapKey(itemKey);
    const item = currentItems.find((i) => selectionIdMatchesItem(mapKey, i));

    if (item && (!item.files || !item.files.length)) {
      validFiles.set(getDownloadSelectionId(item), new Set(fileIds));
      continue;
    }

    if (!item) continue;

    const validFileIds = new Set(
      Array.from(fileIds).filter((fileId) => item.files?.some((file) => file.id === fileId))
    );

    if (validFileIds.size > 0) {
      validFiles.set(getDownloadSelectionId(item), validFileIds);
    }
  }

  return { items: validItems, files: validFiles };
}

export function loadStoredSelections(activeType, currentItems = []) {
  const raw = readRawSelection(activeType);
  const parsed = deserializeSelection(raw);

  if (!currentItems.length) {
    return parsed;
  }

  return pruneSelectionAgainstItems(parsed, currentItems);
}

export const useDownloadsSelectionStore = create((set, get) => ({
  activeType: 'all',
  selectedItems: emptySelection(),
  listSignature: '',
  hasHydratedSelection: false,

  setActiveType: (activeType) => {
    const { activeType: prevType, selectedItems, hasHydratedSelection } = get();
    if (prevType === activeType && hasHydratedSelection) return;

    if (prevType !== activeType) {
      persistSelection(prevType, selectedItems);
    }

    const nextSelection = loadStoredSelections(activeType, []);
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

      persistSelection(state.activeType, next);
      return { selectedItems: next };
    });
  },

  clearSelection: () => {
    const empty = emptySelection();
    persistSelection(get().activeType, empty);
    set({ selectedItems: empty });
  },

  reconcileWithItems: (items) => {
    const signature = downloadListIdSignature(items);
    const { listSignature, activeType } = get();
    if (listSignature === signature) return;

    const pruned = loadStoredSelections(activeType, items || []);
    persistSelection(activeType, pruned);
    set({ listSignature: signature, selectedItems: pruned });
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

export function selectHasSelectedFiles(state) {
  return Array.from(state.selectedItems.files.values()).some((files) => files.size > 0);
}

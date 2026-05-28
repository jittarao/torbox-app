import { useState, useEffect, useRef, useMemo } from 'react';
import { downloadListIdSignature } from '@/utils/downloadListMerge';
import {
  getDownloadSelectionId,
  selectionIdMatchesItem,
} from '@/utils/downloadSelectionId';

const STORAGE_KEY = 'torboxSelectedItems';

function parseFileMapKey(key) {
  if (typeof key === 'string' && key.includes(':')) {
    return key;
  }
  const numeric = parseInt(key, 10);
  return Number.isNaN(numeric) ? key : numeric;
}

export function useSelection(items) {
  const loadStoredSelections = (currentItems) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { items: new Set(), files: new Map() };

      const { items: storedItems, files: storedFiles } = JSON.parse(stored);

      if (!currentItems?.length) {
        return {
          items: new Set(Array.isArray(storedItems) ? storedItems : []),
          files: new Map(
            Object.entries(storedFiles && typeof storedFiles === 'object' ? storedFiles : {}).map(
              ([key, value]) => [parseFileMapKey(key), new Set(Array.isArray(value) ? value : [])]
            )
          ),
        };
      }

      const validItems = new Set(
        (storedItems || []).filter((storedId) =>
          currentItems.some((item) => selectionIdMatchesItem(storedId, item))
        )
      );

      const validFiles = new Map();
      Object.entries(storedFiles || {}).forEach(([itemKey, fileIds]) => {
        const mapKey = parseFileMapKey(itemKey);
        const item = currentItems.find((i) => selectionIdMatchesItem(mapKey, i));

        if (item && (!item.files || !item.files.length)) {
          validFiles.set(getDownloadSelectionId(item), new Set(fileIds));
          return;
        }

        if (!item) return;

        const validFileIds = new Set(
          fileIds.filter((fileId) => item.files?.some((file) => file.id === fileId))
        );

        if (validFileIds.size > 0) {
          validFiles.set(getDownloadSelectionId(item), validFileIds);
        }
      });

      return {
        items: validItems,
        files: validFiles,
      };
    } catch (error) {
      console.error('Error loading selections from localStorage:', error);
      return { items: new Set(), files: new Map() };
    }
  };

  const itemsIdSignature = useMemo(() => downloadListIdSignature(items), [items]);

  const [selectedItems, setSelectedItems] = useState(() => loadStoredSelections());

  const prevIdSignatureRef = useRef(itemsIdSignature);

  useEffect(() => {
    if (!items?.length) return;
    if (prevIdSignatureRef.current === itemsIdSignature) return;
    prevIdSignatureRef.current = itemsIdSignature;
    setSelectedItems(loadStoredSelections(items));
  }, [items, itemsIdSignature]);

  useEffect(() => {
    if (!selectedItems) return;

    try {
      const serialized = JSON.stringify({
        items: Array.from(selectedItems.items),
        files: Object.fromEntries(
          Array.from(selectedItems.files).map(([key, value]) => [key, Array.from(value)])
        ),
      });
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
      console.error('Error saving selections to localStorage:', error);
    }
  }, [selectedItems]);

  const hasSelectedFiles = () => {
    return Array.from(selectedItems.files.values()).some((files) => files.size > 0);
  };

  const handleRowSelect = (selectionId, selectedFiles) => {
    return selectedFiles.has(selectionId) && selectedFiles.get(selectionId).size > 0;
  };

  const handleSelectAll = (items, checked) => {
    setSelectedItems((prev) => ({
      items: checked ? new Set(items.map((t) => getDownloadSelectionId(t))) : new Set(),
      files: new Map(),
    }));
  };

  const handleFileSelect = (selectionId, fileId, checked) => {
    setSelectedItems((prev) => {
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
  };

  return {
    selectedItems,
    setSelectedItems,
    hasSelectedFiles,
    handleRowSelect,
    handleFileSelect,
    handleSelectAll,
    getDownloadSelectionId,
  };
}

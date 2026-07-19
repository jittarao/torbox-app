'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import {
  downloadListReconcileSignature,
  itemsReconcileStructureUnchanged,
} from '@/utils/downloadListMerge';
import { useDownloadsSelectionStore } from '@/store/downloadsSelectionStore';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';

export function useSelection(items, activeType = 'all', apiKey = '') {
  const {
    selectedItems,
    setSelectedItems,
    setActiveType,
    setApiKeyScope,
    handleSelectAll,
    handleFileSelect,
  } = useDownloadsSelectionStore(
    useShallow((s) => ({
      selectedItems: s.selectedItems,
      setSelectedItems: s.setSelectedItems,
      setActiveType: s.setActiveType,
      setApiKeyScope: s.setApiKeyScope,
      handleSelectAll: s.handleSelectAll,
      handleFileSelect: s.handleFileSelect,
    }))
  );

  const prevItemsRef = useRef(null);

  useEffect(() => {
    setApiKeyScope(apiKey);
  }, [apiKey, setApiKeyScope]);

  useEffect(() => {
    setActiveType(activeType);
  }, [activeType, setActiveType]);

  // After render: skip O(n) signature when merge preserved row refs (typical poll).
  useLayoutEffect(() => {
    if (!itemsReconcileStructureUnchanged(prevItemsRef.current, items)) {
      const signature = downloadListReconcileSignature(items);
      const { listSignature, reconcileWithItems } = useDownloadsSelectionStore.getState();
      const filesByEntityKey = useTorboxDownloadsStore.getState().filesByEntityKey;
      if (signature !== listSignature) {
        reconcileWithItems(items, signature, filesByEntityKey);
      }
    }
    prevItemsRef.current = items;
  }, [items]);

  const hasSelectedFiles = () => {
    return Array.from(selectedItems.files.values()).some((files) => files.size > 0);
  };

  return {
    selectedItems,
    setSelectedItems,
    hasSelectedFiles,
    handleFileSelect,
    handleSelectAll,
    getDownloadSelectionId,
  };
}

/** Granular row subscription — re-renders only when this item's selected state changes. */
export function useIsDownloadSelected(selectionId) {
  return useDownloadsSelectionStore((state) => state.selectedItems.items.has(selectionId));
}

export function useItemHasSelectedFiles(selectionId) {
  return useDownloadsSelectionStore((state) => {
    const files = state.selectedItems.files.get(selectionId);
    return files != null && files.size > 0;
  });
}

export function useIsFileSelected(selectionId, fileId) {
  return useDownloadsSelectionStore(
    (state) => state.selectedItems.files.get(selectionId)?.has(fileId) ?? false
  );
}

export function useIsItemBlockingFileSelect(selectionId) {
  return useDownloadsSelectionStore((state) => state.selectedItems.items.has(selectionId));
}

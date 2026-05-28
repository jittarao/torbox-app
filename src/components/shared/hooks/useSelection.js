'use client';

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { useDownloadsSelectionStore } from '@/store/downloadsSelectionStore';

export function useSelection(items, activeType = 'all', apiKey = '') {
  const {
    selectedItems,
    setSelectedItems,
    setActiveType,
    setApiKeyScope,
    reconcileWithItems,
    handleSelectAll,
    handleFileSelect,
  } = useDownloadsSelectionStore(
    useShallow((s) => ({
      selectedItems: s.selectedItems,
      setSelectedItems: s.setSelectedItems,
      setActiveType: s.setActiveType,
      setApiKeyScope: s.setApiKeyScope,
      reconcileWithItems: s.reconcileWithItems,
      handleSelectAll: s.handleSelectAll,
      handleFileSelect: s.handleFileSelect,
    }))
  );

  useEffect(() => {
    setApiKeyScope(apiKey);
  }, [apiKey, setApiKeyScope]);

  useEffect(() => {
    setActiveType(activeType);
  }, [activeType, setActiveType]);

  useEffect(() => {
    reconcileWithItems(items);
  }, [items, reconcileWithItems]);

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

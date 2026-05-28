'use client';

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { useDownloadsSelectionStore } from '@/store/downloadsSelectionStore';

export function useSelection(items, activeType = 'all') {
  const {
    selectedItems,
    setSelectedItems,
    setActiveType,
    reconcileWithItems,
    handleSelectAll,
    handleFileSelect,
  } = useDownloadsSelectionStore(
    useShallow((s) => ({
      selectedItems: s.selectedItems,
      setSelectedItems: s.setSelectedItems,
      setActiveType: s.setActiveType,
      reconcileWithItems: s.reconcileWithItems,
      handleSelectAll: s.handleSelectAll,
      handleFileSelect: s.handleFileSelect,
    }))
  );

  useEffect(() => {
    setActiveType(activeType);
  }, [activeType, setActiveType]);

  useEffect(() => {
    reconcileWithItems(items);
  }, [items, reconcileWithItems]);

  const hasSelectedFiles = () => {
    return Array.from(selectedItems.files.values()).some((files) => files.size > 0);
  };

  const handleRowSelect = (selectionId, selectedFiles) => {
    return selectedFiles.has(selectionId) && selectedFiles.get(selectionId).size > 0;
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

/** Granular row subscription — re-renders only when this item's selected state changes. */
export function useIsDownloadSelected(selectionId) {
  return useDownloadsSelectionStore((state) => state.selectedItems.items.has(selectionId));
}

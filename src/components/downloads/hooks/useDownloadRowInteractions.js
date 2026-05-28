'use client';

import { useCallback, useRef } from 'react';
import { useDownloadsSelectionStore } from '@/store/downloadsSelectionStore';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { getIdFieldForItem, resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { getFilesVisibleForDownloadSearch } from '../utils/downloadSearch';

/**
 * Shared row selection + per-file download handlers for table and card lists.
 */
export function useDownloadRowInteractions({
  items,
  activeType,
  fileSearch,
  onFileSelect,
  downloadSingle,
  setToast,
  toastMessages,
  setIsDownloading,
  setIsCopying,
}) {
  const lastClickedItemIndexRef = useRef(null);
  const lastClickedFileIndexRef = useRef(null);

  const isSelectionDisabled = useCallback((selectionId) => {
    const files = useDownloadsSelectionStore.getState().selectedItems.files;
    return files?.has(selectionId) && files.get(selectionId).size > 0;
  }, []);

  const handleItemSelection = useCallback(
    (selectionId, checked, rowIndex, isShiftKey = false) => {
      const setSelected = useDownloadsSelectionStore.getState().setSelectedItems;

      if (isShiftKey && typeof rowIndex === 'number' && lastClickedItemIndexRef.current !== null) {
        const start = Math.min(lastClickedItemIndexRef.current, rowIndex);
        const end = Math.max(lastClickedItemIndexRef.current, rowIndex);

        setSelected((prev) => {
          const newItems = new Set(prev.items);
          for (let i = start; i <= end; i++) {
            const row = items[i];
            const sid = getDownloadSelectionId(row);
            if (checked && !isSelectionDisabled(sid)) {
              newItems.add(sid);
            } else {
              newItems.delete(sid);
            }
          }
          return {
            items: newItems,
            files: prev.files,
          };
        });
      } else {
        setSelected((prev) => {
          const newItems = new Set(prev.items);
          if (checked && !isSelectionDisabled(selectionId)) {
            newItems.add(selectionId);
          } else {
            newItems.delete(selectionId);
          }
          return {
            items: newItems,
            files: prev.files,
          };
        });
      }
      lastClickedItemIndexRef.current = rowIndex;
    },
    [items, isSelectionDisabled]
  );

  const handleFileSelection = useCallback(
    (selectionId, fileIndex, file, checked, isShiftKey = false) => {
      if (isShiftKey && lastClickedFileIndexRef.current !== null) {
        const start = Math.min(lastClickedFileIndexRef.current, fileIndex);
        const end = Math.max(lastClickedFileIndexRef.current, fileIndex);
        const item = items.find((row) => getDownloadSelectionId(row) === selectionId);
        if (item) {
          getFilesVisibleForDownloadSearch(item, fileSearch)
            .slice(start, end + 1)
            .forEach((f) => {
              onFileSelect(selectionId, f.id, checked);
            });
        }
      } else {
        onFileSelect(selectionId, file.id, checked);
      }
      lastClickedFileIndexRef.current = fileIndex;
    },
    [items, onFileSelect, fileSearch]
  );

  const assetKey = useCallback((itemId, fileId) => (fileId ? `${itemId}-${fileId}` : itemId), []);

  const handleFileDownload = useCallback(
    async (itemId, file, copyLink = false) => {
      const key = assetKey(itemId, file.id);
      if (copyLink) {
        setIsCopying((prev) => ({ ...prev, [key]: true }));
      } else {
        setIsDownloading((prev) => ({ ...prev, [key]: true }));
      }
      const options = { fileId: file.id, filename: file.name };

      const item = items.find((row) => row.id === itemId);
      const idField = getIdFieldForItem(item, activeType);

      const metadata = {
        assetType: resolveItemAssetType(item, activeType),
        item,
      };

      await downloadSingle(itemId, options, idField, copyLink, metadata)
        .then(() => {
          setToast({
            message: toastMessages.copyLinkSuccess,
            type: 'success',
          });
        })
        .catch(() => {
          setToast({
            message: toastMessages.copyLinkFailed,
            type: 'error',
          });
        })
        .finally(() => {
          if (copyLink) {
            setIsCopying((prev) => ({ ...prev, [key]: false }));
          } else {
            setIsDownloading((prev) => ({ ...prev, [key]: false }));
          }
        });
    },
    [
      assetKey,
      activeType,
      items,
      downloadSingle,
      setToast,
      toastMessages,
      setIsCopying,
      setIsDownloading,
    ]
  );

  return {
    handleItemSelection,
    handleFileSelection,
    handleFileDownload,
    isSelectionDisabled,
    assetKey,
    lastClickedItemIndexRef,
    lastClickedFileIndexRef,
  };
}

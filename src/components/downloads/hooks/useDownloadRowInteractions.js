'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useDownloadsSelectionStore } from '@/store/downloadsSelectionStore';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { useFileInteractionStore } from '@/store/fileInteractionStore';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { getIdFieldForItem, resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { getFilesVisibleForDownloadSearch } from '../utils/downloadSearch';
import { resolveItemFiles } from '@/utils/downloadEntityFiles';

function findEntityBySelectionId(entityKeys, selectionId) {
  if (!entityKeys?.length) return null;
  const entities = useTorboxDownloadsStore.getState().entities;
  for (const key of entityKeys) {
    const row = entities[key];
    if (row && getDownloadSelectionId(row) === selectionId) {
      return row;
    }
  }
  return null;
}

function findEntityByItemId(entityKeys, itemId) {
  if (!entityKeys?.length) return null;
  const entities = useTorboxDownloadsStore.getState().entities;
  for (const key of entityKeys) {
    const row = entities[key];
    if (row && String(row.id) === String(itemId)) {
      return row;
    }
  }
  return null;
}

/**
 * Shared row selection + per-file download handlers for table and card lists.
 * Pass `entityKeys` to resolve rows via getState() and avoid whole-map store subscriptions.
 */
export function useDownloadRowInteractions({
  items,
  entityKeys,
  activeType,
  fileSearch,
  onFileSelect,
  downloadSingle,
  setToast,
  toastMessages,
}) {
  const lastClickedItemIndexRef = useRef(null);
  const lastClickedFileIndexRef = useRef(null);
  const entityKeysRef = useRef(entityKeys);
  entityKeysRef.current = entityKeys;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const getItemAtIndex = useCallback((index) => {
    const keys = entityKeysRef.current;
    if (keys?.length) {
      const key = keys[index];
      return key ? (useTorboxDownloadsStore.getState().entities[key] ?? null) : null;
    }
    return itemsRef.current?.[index] ?? null;
  }, []);

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
            const row = getItemAtIndex(i);
            if (!row) continue;
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
    [getItemAtIndex, isSelectionDisabled]
  );

  const handleFileSelection = useCallback(
    (selectionId, fileIndex, file, checked, isShiftKey = false) => {
      if (isShiftKey && lastClickedFileIndexRef.current !== null) {
        const start = Math.min(lastClickedFileIndexRef.current, fileIndex);
        const end = Math.max(lastClickedFileIndexRef.current, fileIndex);
        const keys = entityKeysRef.current;
        const item = keys?.length
          ? findEntityBySelectionId(keys, selectionId)
          : itemsRef.current?.find((row) => getDownloadSelectionId(row) === selectionId);
        if (item) {
          getFilesVisibleForDownloadSearch(
            item,
            fileSearch,
            useTorboxDownloadsStore.getState().filesByEntityKey
          )
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
    [fileSearch, onFileSelect]
  );

  const assetKey = useCallback((itemId, fileId) => (fileId ? `${itemId}-${fileId}` : itemId), []);

  const handleFileDownload = useCallback(
    async (itemId, file, copyLink = false) => {
      const key = assetKey(itemId, file.id);
      const store = useFileInteractionStore.getState();
      if (copyLink) {
        store.setCopying(key, true);
      } else {
        store.setDownloading(key, true);
      }
      const options = { fileId: file.id, filename: file.name };

      const keys = entityKeysRef.current;
      const item = keys?.length
        ? findEntityByItemId(keys, itemId)
        : itemsRef.current?.find((row) => row.id === itemId);
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
          const st = useFileInteractionStore.getState();
          if (copyLink) {
            st.setCopying(key, false);
          } else {
            st.setDownloading(key, false);
          }
        });
    },
    [assetKey, activeType, downloadSingle, setToast, toastMessages]
  );

  return useMemo(
    () => ({
      handleItemSelection,
      handleFileSelection,
      handleFileDownload,
      isSelectionDisabled,
      assetKey,
      lastClickedItemIndexRef,
      lastClickedFileIndexRef,
    }),
    [handleItemSelection, handleFileSelection, handleFileDownload, isSelectionDisabled, assetKey]
  );
}

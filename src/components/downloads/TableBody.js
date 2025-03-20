'use client';

import { Fragment, useState, useRef } from 'react';
import ItemRow from './ItemRow';
import FileRow from './FileRow';
import { useDownloads } from '../shared/hooks/useDownloads';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';

export default function TableBody({
  items,
  setItems,
  activeColumns,
  columnWidths,
  selectedItems,
  onRowSelect,
  onFileSelect,
  setSelectedItems,
  downloadHistory,
  setDownloadHistory,
  expandedItems,
  toggleFiles,
  apiKey,
  onDelete,
  setToast,
  activeType = 'torrents',
  isBlurred = false,
  viewMode = 'table',
  tableWidth,
}) {
  const t = useTranslations('TableBody');

  // Shared ref for tracking last clicked item row index
  const lastClickedItemIndexRef = useRef(null);
  const lastClickedFileIndexRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState({});
  const [isCopying, setIsCopying] = useState({});
  const { downloadSingle } = useDownloads(
    apiKey,
    activeType,
    downloadHistory,
    setDownloadHistory,
  );
  const isMobile = useIsMobile();

  const handleItemSelection = (
    itemId,
    checked,
    rowIndex,
    isShiftKey = false,
  ) => {
    if (
      isShiftKey &&
      typeof rowIndex === 'number' &&
      lastClickedItemIndexRef.current !== null
    ) {
      const start = Math.min(lastClickedItemIndexRef.current, rowIndex);
      const end = Math.max(lastClickedItemIndexRef.current, rowIndex);

      setSelectedItems((prev) => {
        const newItems = new Set(prev.items);
        for (let i = start; i <= end; i++) {
          const t = items[i];
          if (checked && !isDisabled(t.id)) {
            newItems.add(t.id);
          } else {
            newItems.delete(t.id);
          }
        }
        return {
          items: newItems,
          files: prev.files,
        };
      });
    } else {
      setSelectedItems((prev) => {
        const newItems = new Set(prev.items);
        if (checked && !isDisabled(itemId)) {
          newItems.add(itemId);
        } else {
          newItems.delete(itemId);
        }
        return {
          items: newItems,
          files: prev.files,
        };
      });
    }
    lastClickedItemIndexRef.current = rowIndex;
  };

  const handleFileSelection = (
    itemId,
    fileIndex,
    file,
    checked,
    isShiftKey = false,
  ) => {
    if (isShiftKey && lastClickedFileIndexRef.current !== null) {
      const start = Math.min(lastClickedFileIndexRef.current, fileIndex);
      const end = Math.max(lastClickedFileIndexRef.current, fileIndex);
      const item = items.find((i) => i.id === itemId);
      if (item) {
        item.files.slice(start, end + 1).forEach((f) => {
          onFileSelect(itemId, f.id, checked);
        });
      }
    } else {
      onFileSelect(itemId, file.id, checked);
    }
    lastClickedFileIndexRef.current = fileIndex;
  };

  const assetKey = (itemId, fileId) =>
    fileId ? `${itemId}-${fileId}` : itemId;

  const handleFileDownload = async (itemId, fileId, copyLink = false) => {
    const key = assetKey(itemId, fileId);
    if (copyLink) {
      setIsCopying((prev) => ({ ...prev, [key]: true }));
    } else {
      setIsDownloading((prev) => ({ ...prev, [key]: true }));
    }
    const options = { fileId };

    const idField =
      activeType === 'usenet'
        ? 'usenet_id'
        : activeType === 'webdl'
          ? 'web_id'
          : 'torrent_id';

    const metadata = {
      assetType: activeType,
      item: items.find((item) => item.id === itemId),
    };

    await downloadSingle(itemId, options, idField, copyLink, metadata)
      .then(() => {
        setToast({
          message: t('toast.copyLink'),
          type: 'success',
        });
      })
      .catch((err) => {
        setToast({
          message: t('toast.copyLinkFailed'),
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
  };

  const isDisabled = (itemId) => {
    return (
      selectedItems.files?.has(itemId) &&
      selectedItems.files.get(itemId).size > 0
    );
  };

  return (
    <tbody className="bg-surface dark:bg-surface-dark divide-y divide-border dark:divide-border-dark">
      {items.map((item, index) => (
        <Fragment key={item.id}>
          <ItemRow
            item={item}
            activeColumns={activeColumns}
            columnWidths={columnWidths}
            selectedItems={selectedItems}
            setItems={setItems}
            setSelectedItems={setSelectedItems}
            downloadHistory={downloadHistory}
            setDownloadHistory={setDownloadHistory}
            onRowSelect={onRowSelect}
            expandedItems={expandedItems}
            toggleFiles={toggleFiles}
            apiKey={apiKey}
            onDelete={onDelete}
            // props for shift+click functionality
            rowIndex={index}
            handleItemSelection={handleItemSelection}
            setToast={setToast}
            activeType={activeType}
            isMobile={isMobile}
            isBlurred={isBlurred}
            viewMode={viewMode}
            tableWidth={tableWidth}
          />
          {expandedItems.has(item.id) && item.files && (
            <FileRow
              item={item}
              selectedItems={selectedItems}
              handleFileSelection={handleFileSelection}
              handleFileDownload={handleFileDownload}
              downloadHistory={downloadHistory}
              activeColumns={activeColumns}
              isMobile={isMobile}
              isBlurred={isBlurred}
              isCopying={isCopying}
              isDownloading={isDownloading}
              isTable={true}
              tableWidth={tableWidth}
            />
          )}
        </Fragment>
      ))}
    </tbody>
  );
}

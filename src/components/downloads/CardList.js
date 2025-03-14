import { useRef, useState } from 'react';
import { useDownloads } from '../shared/hooks/useDownloads';
import ItemCard from './ItemCard';
import { useTranslations } from 'next-intl';

export default function CardList({
  items,
  selectedItems,
  setSelectedItems,
  setItems,
  apiKey,
  activeColumns,
  onFileSelect,
  downloadHistory,
  setDownloadHistory,
  onDelete,
  expandedItems,
  toggleFiles,
  setToast,
  activeType,
  isBlurred,
  isFullscreen,
  viewMode = 'card',
}) {
  const t = useTranslations('CardList');
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

  const isItemDownloaded = (itemId) => {
    return downloadHistory.some(
      (download) => download.itemId === itemId && !download.fileId,
    );
  };

  const isFileDownloaded = (itemId, fileId) => {
    return downloadHistory.some(
      (download) => download.itemId === itemId && download.fileId === fileId,
    );
  };

  return (
    <div className={`flex flex-col gap-2 ${isFullscreen ? 'p-4' : 'p-0'}`}>
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          index={index}
          selectedItems={selectedItems}
          downloadHistory={downloadHistory}
          setDownloadHistory={setDownloadHistory}
          isItemDownloaded={isItemDownloaded}
          isFileDownloaded={isFileDownloaded}
          isBlurred={isBlurred}
          isDisabled={isDisabled}
          activeColumns={activeColumns}
          onItemSelect={handleItemSelection}
          onFileSelect={handleFileSelection}
          onFileDownload={handleFileDownload}
          onDelete={onDelete}
          toggleFiles={toggleFiles}
          expandedItems={expandedItems}
          setItems={setItems}
          setSelectedItems={setSelectedItems}
          setToast={setToast}
          activeType={activeType}
          viewMode={viewMode}
          isCopying={isCopying}
          isDownloading={isDownloading}
        />
      ))}
    </div>
  );
}

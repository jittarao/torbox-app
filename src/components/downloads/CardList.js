import { useRef, useState, useMemo, useDeferredValue } from 'react';
import useIsMobile from '@/hooks/useIsMobile';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  const parentRef = useRef(null);
  const { downloadSingle } = useDownloads(
    apiKey,
    activeType,
    downloadHistory,
    setDownloadHistory,
  );
  const isMobile = useIsMobile();

  // Defer items update to prevent synchronous updates during render
  const deferredItems = useDeferredValue(items);

  // Only virtualize ItemCards - FileList will handle its own virtualization
  const flattenedRows = useMemo(() => {
    return deferredItems.map((item, itemIndex) => ({
      item,
      itemIndex,
    }));
  }, [deferredItems]);

  // Find scrollable parent container
  const getScrollElement = () => {
    if (parentRef.current) {
      // Find the nearest scrollable parent with a constrained height
      let parent = parentRef.current.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        const hasOverflow = style.overflowY === 'auto' || style.overflowY === 'scroll';
        const hasMaxHeight = style.maxHeight && style.maxHeight !== 'none';
        const hasHeight = style.height && style.height !== 'auto';
        const isScrollable = parent.scrollHeight > parent.clientHeight;
        
        // Check if parent has overflow and a height constraint (required for virtualization)
        if (hasOverflow && (hasMaxHeight || hasHeight || isScrollable)) {
          return parent;
        }
        parent = parent.parentElement;
      }
      // Fallback to window if no constrained parent found
      return null;
    }
    return null;
  };

  // Virtualizer setup - use dynamic measurements for variable heights
  const virtualizer = useVirtualizer({
    count: flattenedRows.length,
    getScrollElement,
    estimateSize: () => {
      // Height estimates for mobile vs desktop
      // Mobile cards are taller due to vertical layouts
      // This will be refined by measureElement, but a good estimate helps initial render
      return isMobile ? 170 : 82;
    },
    measureElement: (element) => {
      // Measure the actual rendered height of the element
      // Add margin for spacing between cards
      return element.getBoundingClientRect().height + 8;
    },
    overscan: 5,
  });

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

  const handleFileDownload = async (itemId, file, copyLink = false) => {
    const key = assetKey(itemId, file.id);
    if (copyLink) {
      setIsCopying((prev) => ({ ...prev, [key]: true }));
    } else {
      setIsDownloading((prev) => ({ ...prev, [key]: true }));
    }
    const options = { fileId: file.id, filename: file.name };

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

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className={`${isFullscreen ? 'p-4' : 'p-0'}`}
      style={{
        position: 'relative',
        height: `${totalSize}px`,
      }}
    >
      {/* Virtualized rows - only ItemCards */}
      {virtualRows.map((virtualRow) => {
        const row = flattenedRows[virtualRow.index];

        // Calculate item card position
        const itemCardStyle = {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${virtualRow.start}px)`,
          marginBottom: '8px', // Add gap between cards
        };

        return (
          <div
            key={`item-${row.item.id}`}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={itemCardStyle}
          >
            <ItemCard
              item={row.item}
              index={row.itemIndex}
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
              expandedItems={expandedItems} // Pass expandedItems so ItemCard can render FileList
              setItems={setItems}
              setSelectedItems={setSelectedItems}
              setToast={setToast}
              activeType={activeType}
              viewMode={viewMode}
              isCopying={isCopying}
              isDownloading={isDownloading}
            />
          </div>
        );
      })}
    </div>
  );
}

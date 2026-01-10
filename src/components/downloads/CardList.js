import { useRef, useState, useMemo, useDeferredValue, useCallback, useEffect } from 'react';
import useIsMobile from '@/hooks/useIsMobile';
import { useWindowVirtualizer, useVirtualizer } from '@tanstack/react-virtual';
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
  scrollContainerRef,
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
  const scrollElementRef = useRef(null);
  const containerOffsetTopRef = useRef(0);
  const [containerOffsetTop, setContainerOffsetTop] = useState(0);

  // In fullscreen mode, use the provided scroll container ref
  // In normal mode, track container position for window scroll
  useEffect(() => {
    if (isFullscreen) {
      // Use the provided scroll container ref
      if (scrollContainerRef?.current) {
        scrollElementRef.current = scrollContainerRef.current;
      }
    } else {
      // Track the container's position in the document for window scroll
      const updateContainerOffset = () => {
        if (parentRef.current) {
          const rect = parentRef.current.getBoundingClientRect();
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const offset = rect.top + scrollTop;
          containerOffsetTopRef.current = offset;
          setContainerOffsetTop(offset);
        }
      };

      // Calculate immediately and after DOM is ready
      updateContainerOffset();
      requestAnimationFrame(updateContainerOffset);
      
      // Only listen to resize, not scroll, to avoid constant updates
      window.addEventListener('resize', updateContainerOffset);

      return () => {
        window.removeEventListener('resize', updateContainerOffset);
      };
    }
  }, [isFullscreen, scrollContainerRef]);

  // Defer items update to prevent synchronous updates during render
  const deferredItems = useDeferredValue(items);

  // Only virtualize ItemCards - FileList will handle its own virtualization
  const flattenedRows = useMemo(() => {
    return deferredItems.map((item, itemIndex) => ({
      item,
      itemIndex,
    }));
  }, [deferredItems]);

  // Memoize measureElement to prevent unnecessary re-renders
  const measureElement = useCallback((element) => {
    // Measure the actual rendered height of the element
    // Add margin for spacing between cards
    return element.getBoundingClientRect().height + 8;
  }, []);

  // Memoize estimateSize to prevent recalculation on every render
  const estimateSize = useCallback(() => {
    // Height estimates for mobile vs desktop
    // Mobile cards are taller due to vertical layouts
    // This will be refined by measureElement, but a good estimate helps initial render
    return isMobile ? 170 : 82;
  }, [isMobile]);

  // Use different virtualizers based on fullscreen mode
  // In fullscreen: use useVirtualizer with scroll container
  // In normal mode: use useWindowVirtualizer for window scroll
  // Disabled useFlushSync to allow React to batch updates for better performance
  const windowVirtualizer = useWindowVirtualizer({
    count: flattenedRows.length,
    estimateSize,
    measureElement,
    overscan: 30,
    scrollMargin: containerOffsetTopRef.current || containerOffsetTop,
    useFlushSync: false, // Allow React to batch updates for smoother fast scrolling
  });

  const containerVirtualizer = useVirtualizer({
    count: flattenedRows.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize,
    measureElement,
    overscan: 30,
    useFlushSync: false, // Allow React to batch updates for smoother fast scrolling
  });

  // Use the appropriate virtualizer based on mode
  const virtualizer = isFullscreen ? containerVirtualizer : windowVirtualizer;

  // Define isDisabled first so it can be used in handlers
  const isDisabled = useCallback((itemId) => {
    return (
      selectedItems.files?.has(itemId) &&
      selectedItems.files.get(itemId).size > 0
    );
  }, [selectedItems]);

  const handleItemSelection = useCallback((
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
  }, [items, setSelectedItems, isDisabled]);

  const handleFileSelection = useCallback((
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
  }, [items, onFileSelect]);

  const assetKey = useCallback((itemId, fileId) =>
    fileId ? `${itemId}-${fileId}` : itemId, []);

  const handleFileDownload = useCallback(async (itemId, file, copyLink = false) => {
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
  }, [assetKey, activeType, items, downloadSingle, setToast, t]);

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
        // In fullscreen: virtualRow.start is relative to scroll container (no conversion needed)
        // In normal mode: virtualRow.start is relative to document top, convert to container-relative
        let cardTop = 0;
        if (isFullscreen) {
          // In fullscreen, virtualRow.start is already relative to the scroll container
          cardTop = virtualRow.start;
        } else if (containerOffsetTop > 0) {
          // In normal mode, convert document-relative to container-relative
          cardTop = virtualRow.start - containerOffsetTop;
        } else {
          // Fallback: if containerOffsetTop not calculated yet, use a simple sum
          for (let i = 0; i < virtualRow.index; i++) {
            cardTop += estimateSize();
          }
        }
        
        const itemCardStyle = {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${cardTop}px)`,
          marginBottom: '8px', // Add gap between cards
          willChange: 'transform',
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
      {/* Bottom spacer for cards after last visible */}
      {virtualRows.length > 0 && (() => {
        const lastVisibleRow = virtualRows[virtualRows.length - 1];
        const lastVisibleIndex = lastVisibleRow?.index ?? 0;
        
        // Calculate height of cards after the last visible card
        let bottomOffset = 0;
        if (lastVisibleIndex < flattenedRows.length - 1) {
          // Sum estimated sizes of all cards after the last visible card
          for (let i = lastVisibleIndex + 1; i < flattenedRows.length; i++) {
            bottomOffset += estimateSize();
          }
        }
        
        // Only show bottom spacer if there are cards after the last visible one
        return bottomOffset > 0 ? (
          <div style={{ height: bottomOffset }} />
        ) : null;
      })()}
    </div>
  );
}

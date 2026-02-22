'use client';

import {
  useState,
  useRef,
  useMemo,
  useDeferredValue,
  useCallback,
  useEffect,
  useLayoutEffect,
  startTransition,
} from 'react';
import { useWindowVirtualizer, useVirtualizer } from '@tanstack/react-virtual';
import ItemRow from './ItemRow';
import FileRow from './FileRow';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
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
  expandedItems,
  toggleFiles,
  apiKey,
  onDelete,
  setToast,
  activeType = 'torrents',
  isBlurred = false,
  viewMode = 'table',
  tableWidth,
  isFullscreen,
  scrollContainerRef,
  onFileStreamInit,
  onAudioPlay,
}) {
  const t = useTranslations('TableBody');

  // Shared ref for tracking last clicked item row index
  const lastClickedItemIndexRef = useRef(null);
  const lastClickedFileIndexRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState({});
  const [isCopying, setIsCopying] = useState({});
  const [isStreaming, setIsStreaming] = useState({});
  const fetchDownloadHistory = useDownloadHistoryStore((state) => state.fetchDownloadHistory);
  const { downloadSingle } = useDownloads(
    apiKey,
    activeType,
    downloadHistory,
    fetchDownloadHistory
  );
  const isMobile = useIsMobile();
  const tbodyRef = useRef(null);
  const scrollElementRef = useRef(null);
  const tableOffsetTopRef = useRef(0);
  const [tableOffsetTop, setTableOffsetTop] = useState(0);

  // In fullscreen mode, use the provided scroll container ref
  // In normal mode, track table position for window scroll
  useEffect(() => {
    if (isFullscreen) {
      // Use the provided scroll container ref
      if (scrollContainerRef?.current) {
        scrollElementRef.current = scrollContainerRef.current;
      }
    } else {
      // Track the table's position in the document for window scroll
      const updateTableOffset = () => {
        if (tbodyRef.current) {
          const rect = tbodyRef.current.getBoundingClientRect();
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const offset = rect.top + scrollTop;
          tableOffsetTopRef.current = offset;
          setTableOffsetTop(offset);
        }
      };

      // Calculate immediately and after DOM is ready
      updateTableOffset();
      requestAnimationFrame(updateTableOffset);

      // Only listen to resize, not scroll, to avoid constant updates
      window.addEventListener('resize', updateTableOffset);

      return () => {
        window.removeEventListener('resize', updateTableOffset);
      };
    }
  }, [isFullscreen, scrollContainerRef]);

  // Defer items update to prevent synchronous updates during render
  const deferredItems = useDeferredValue(items);
  const deferredExpandedItems = useDeferredValue(expandedItems);

  // Create a stable representation of expanded items for memoization
  // Convert Set to sorted array for stable comparison
  const expandedItemsArray = useMemo(() => {
    return Array.from(deferredExpandedItems).sort();
  }, [deferredExpandedItems]);

  // Create flattened array of rows (item rows + file rows when expanded)
  const flattenedRows = useMemo(() => {
    const rows = [];
    const expandedSet = new Set(expandedItemsArray);

    deferredItems.forEach((item, itemIndex) => {
      // Add item row
      rows.push({
        type: 'item',
        item,
        itemIndex,
        virtualIndex: rows.length,
      });

      // Add file rows if expanded
      if (expandedSet.has(item.id) && item.files && item.files.length > 0) {
        item.files.forEach((file, fileIndex) => {
          rows.push({
            type: 'file',
            item,
            file,
            itemIndex,
            fileIndex,
            virtualIndex: rows.length,
          });
        });
      }
    });
    return rows;
  }, [deferredItems, expandedItemsArray]);

  // Memoize measureElement to prevent unnecessary re-renders
  const measureElement = useCallback((element) => {
    // Measure the actual rendered height of the row
    // Add a small buffer for borders/spacing
    return element.getBoundingClientRect().height + 1;
  }, []);

  // Memoize estimateSize to prevent recalculation on every render
  const estimateSize = useCallback(
    (index) => {
      const row = flattenedRows[index];
      // Height estimates for mobile vs desktop
      // Mobile rows are much taller due to vertical action layout and extra info
      if (isMobile) {
        return row?.type === 'item' ? 170 : 60;
      }
      // Desktop estimates
      return row?.type === 'item' ? 70 : 50;
    },
    [flattenedRows, isMobile]
  );

  // Memoize getScrollElement to ensure stable reference
  const getScrollElement = useCallback(() => scrollElementRef.current, []);

  // Use different virtualizers based on fullscreen mode
  // In fullscreen: use useVirtualizer with scroll container
  // In normal mode: use useWindowVirtualizer for window scroll
  const windowVirtualizer = useWindowVirtualizer({
    count: flattenedRows.length,
    estimateSize,
    measureElement,
    overscan: 30,
    scrollMargin: tableOffsetTopRef.current || tableOffsetTop,
    useFlushSync: false, // Allow React to batch updates for smoother fast scrolling
  });

  const containerVirtualizer = useVirtualizer({
    count: flattenedRows.length,
    getScrollElement,
    estimateSize,
    measureElement,
    overscan: 30,
    useFlushSync: false, // Allow React to batch updates for smoother fast scrolling
  });

  // Use the appropriate virtualizer based on mode - memoize to ensure stable reference
  const virtualizer = useMemo(
    () => (isFullscreen ? containerVirtualizer : windowVirtualizer),
    [isFullscreen, containerVirtualizer, windowVirtualizer]
  );

  // Define isDisabled first so it can be used in handlers
  const isDisabled = useCallback(
    (itemId) => {
      return selectedItems.files?.has(itemId) && selectedItems.files.get(itemId).size > 0;
    },
    [selectedItems]
  );

  const handleItemSelection = useCallback(
    (itemId, checked, rowIndex, isShiftKey = false) => {
      if (isShiftKey && typeof rowIndex === 'number' && lastClickedItemIndexRef.current !== null) {
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
    },
    [items, setSelectedItems, isDisabled]
  );

  const handleFileSelection = useCallback(
    (itemId, fileIndex, file, checked, isShiftKey = false) => {
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
    },
    [items, onFileSelect]
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

      const idField =
        activeType === 'usenet' ? 'usenet_id' : activeType === 'webdl' ? 'web_id' : 'torrent_id';

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
    },
    [assetKey, activeType, items, downloadSingle, setToast, t]
  );

  const handleFileStream = useCallback(
    async (itemId, file) => {
      const key = assetKey(itemId, file.id);
      setIsStreaming((prev) => ({ ...prev, [key]: true }));

      try {
        // Call the parent's handler to get metadata and show track selection modal
        if (onFileStreamInit) {
          await onFileStreamInit(itemId, file);
        }
      } catch (error) {
        console.error('Error initiating stream:', error);
        setToast({
          message: error.message || 'Failed to initiate stream',
          type: 'error',
        });
      } finally {
        setIsStreaming((prev) => ({ ...prev, [key]: false }));
      }
    },
    [assetKey, onFileStreamInit, setToast]
  );

  const handleAudioPlay = useCallback(
    async (itemId, file) => {
      const key = assetKey(itemId, file.id);
      setIsStreaming((prev) => ({ ...prev, [key]: true }));
      try {
        if (onAudioPlay) {
          await onAudioPlay(itemId, file);
        }
      } catch (error) {
        console.error('Error opening audio:', error);
        setToast({
          message: error.message || 'Failed to open audio',
          type: 'error',
        });
      } finally {
        setIsStreaming((prev) => ({ ...prev, [key]: false }));
      }
    },
    [assetKey, onAudioPlay, setToast]
  );

  const rowStyle = useMemo(
    () => ({
      willChange: 'transform',
    }),
    []
  );

  // Track view mode changes to prevent flushSync errors
  const prevViewModeRef = useRef(viewMode);
  const isTransitioningRef = useRef(false);
  const [virtualRows, setVirtualRows] = useState([]);
  // Ref to latest virtualizer so effects don't depend on it (virtualizer reference changes every render)
  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  // Check for view mode change synchronously during render
  if (prevViewModeRef.current !== viewMode) {
    isTransitioningRef.current = true;
    prevViewModeRef.current = viewMode;
    // Clear virtual rows during transition
    if (virtualRows.length > 0) {
      setVirtualRows([]);
    }
  }

  // Update virtual rows after render completes to prevent flushSync errors
  // This is critical when switching from Card to Table view
  useLayoutEffect(() => {
    const v = virtualizerRef.current;
    const updateRows = () => {
      try {
        const rows = v.getVirtualItems();
        setVirtualRows(rows);
        // Mark transition as complete after update
        isTransitioningRef.current = false;
      } catch (error) {
        // Silently handle errors - will retry on next effect run
        isTransitioningRef.current = false;
      }
    };

    // Use requestAnimationFrame to ensure we're outside the render phase
    const rafId = requestAnimationFrame(updateRows);
    return () => cancelAnimationFrame(rafId);
  }, [viewMode, flattenedRows.length]);

  // Update virtual rows on scroll to keep them in sync
  // This ensures scroll updates work even though we're using state
  useEffect(() => {
    // Skip during transitions
    if (isTransitioningRef.current) return;

    const updateRows = () => {
      try {
        const rows = virtualizerRef.current.getVirtualItems();
        setVirtualRows(rows);
      } catch (error) {
        // Silently handle errors
      }
    };

    // Use an interval to update rows frequently for smooth scrolling
    // This is more reliable than scroll events which might be throttled
    const intervalId = setInterval(() => {
      requestAnimationFrame(updateRows);
    }, 16); // ~60fps

    return () => clearInterval(intervalId);
  }, []);

  // Get virtual rows - always use state to prevent flushSync errors
  // State is updated in effects to keep it in sync with scroll
  const currentVirtualRows = virtualRows;

  // Calculate startOffset - only show spacer for rows that are actually before the first visible
  // In fullscreen: use container scroll position
  // In normal mode: useWindowVirtualizer calculates from document top, but table starts at tableOffsetTop
  const firstVisibleRow = currentVirtualRows[0];
  let startOffset = 0;

  if (firstVisibleRow && firstVisibleRow.index > 0) {
    if (isFullscreen) {
      // In fullscreen mode, calculate offset based on container scroll
      // Sum estimated sizes of all rows before the first visible row
      for (let i = 0; i < firstVisibleRow.index; i++) {
        startOffset += estimateSize(i);
      }
    } else if (tableOffsetTop > 0) {
      // In normal mode, use window scroll position
      const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

      // Only show spacer if we've scrolled past where the table content starts
      if (currentScrollY > tableOffsetTop) {
        // Calculate the offset within the table by summing row sizes
        // But limit it to a reasonable maximum based on scroll position
        const scrollIntoTable = currentScrollY - tableOffsetTop;

        for (let i = 0; i < firstVisibleRow.index; i++) {
          startOffset += estimateSize(i);
        }

        // Don't show a spacer larger than how far we've scrolled into the table
        // This prevents the huge spacer issue
        startOffset = Math.min(startOffset, scrollIntoTable);
      }
    }
  }

  // Show empty state when there are no items
  if (deferredItems.length === 0) {
    return (
      <tbody
        ref={tbodyRef}
        className="bg-surface dark:bg-surface-dark divide-y divide-border dark:divide-border-dark"
      >
        <tr>
          <td
            colSpan={activeColumns.length + 2}
            className="text-center py-8 text-text-secondary dark:text-text-secondary-dark"
          >
            {t('noDownloads')}
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody
      ref={tbodyRef}
      className="bg-surface dark:bg-surface-dark divide-y divide-border dark:divide-border-dark"
    >
      {/* Top spacer */}
      {startOffset > 0 && (
        <tr>
          <td colSpan={activeColumns.length + 2} style={{ height: startOffset, padding: 0 }} />
        </tr>
      )}
      {/* Virtualized rows */}
      {currentVirtualRows
        .filter((virtualRow) => {
          // Filter out invalid indices (can happen during data updates)
          return virtualRow.index >= 0 && virtualRow.index < flattenedRows.length;
        })
        .map((virtualRow) => {
          const row = flattenedRows[virtualRow.index];

          if (row.type === 'item') {
            return (
              <ItemRow
                key={`item-${row.item.id}`}
                item={row.item}
                activeColumns={activeColumns}
                columnWidths={columnWidths}
                selectedItems={selectedItems}
                setItems={setItems}
                setSelectedItems={setSelectedItems}
                downloadHistory={downloadHistory}
                onRowSelect={onRowSelect}
                expandedItems={expandedItems}
                toggleFiles={toggleFiles}
                apiKey={apiKey}
                onDelete={onDelete}
                rowIndex={row.itemIndex}
                handleItemSelection={handleItemSelection}
                setToast={setToast}
                activeType={activeType}
                isMobile={isMobile}
                isBlurred={isBlurred}
                viewMode={viewMode}
                tableWidth={tableWidth}
                measureRef={virtualizer.measureElement}
                dataIndex={virtualRow.index}
                style={rowStyle}
              />
            );
          } else {
            // File row - use FileRow component to render the specific file
            return (
              <FileRow
                key={`file-${row.item.id}-${row.file.id}`}
                item={row.item}
                selectedItems={selectedItems}
                handleFileSelection={handleFileSelection}
                handleFileDownload={handleFileDownload}
                handleFileStream={handleFileStream}
                handleAudioPlay={handleAudioPlay}
                activeColumns={activeColumns}
                downloadHistory={downloadHistory}
                isCopying={isCopying}
                isDownloading={isDownloading}
                isStreaming={isStreaming}
                isMobile={isMobile}
                isBlurred={isBlurred}
                tableWidth={tableWidth}
                fileIndex={row.fileIndex}
                measureRef={virtualizer.measureElement}
                dataIndex={virtualRow.index}
                style={rowStyle}
              />
            );
          }
        })}
      {/* Bottom spacer */}
      {currentVirtualRows.length > 0 &&
        (() => {
          const lastVisibleRow = currentVirtualRows[currentVirtualRows.length - 1];
          const lastVisibleIndex = lastVisibleRow?.index ?? 0;

          // Calculate height of rows after the last visible row
          let bottomOffset = 0;
          if (lastVisibleIndex < flattenedRows.length - 1) {
            // Sum estimated sizes of all rows after the last visible row
            for (let i = lastVisibleIndex + 1; i < flattenedRows.length; i++) {
              bottomOffset += estimateSize(i);
            }
          }

          // Only show bottom spacer if there are rows after the last visible one
          return bottomOffset > 0 ? (
            <tr>
              <td
                colSpan={activeColumns.length + 2}
                style={{
                  height: bottomOffset,
                  padding: 0,
                }}
              />
            </tr>
          ) : null;
        })()}
    </tbody>
  );
}

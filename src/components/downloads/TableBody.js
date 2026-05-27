'use client';

import {
  useState,
  useRef,
  useMemo,
  useDeferredValue,
  useCallback,
  useEffect,
  useLayoutEffect,
} from 'react';
import { useWindowVirtualizer, useVirtualizer } from '@tanstack/react-virtual';
import ItemRow from './ItemRow';
import FileRow from './FileRow';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';
import { getFilesVisibleForDownloadSearch } from './utils/downloadSearch';

export default function TableBody({
  items,
  setItems,
  activeColumns,
  resolvedColumnWidths,
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
  fileSearch = '',
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
  const tableOffsetTopRef = useRef(0);
  const [tableOffsetTop, setTableOffsetTop] = useState(0);
  // State (not ref) so binding the fullscreen scroll container triggers a re-render
  const [fullscreenScrollEl, setFullscreenScrollEl] = useState(null);

  // Bind scroll container before paint when entering fullscreen
  useLayoutEffect(() => {
    if (isFullscreen) {
      const el = scrollContainerRef?.current ?? null;
      setFullscreenScrollEl(el);
    } else {
      setFullscreenScrollEl(null);
    }
  }, [isFullscreen, scrollContainerRef]);

  // In normal mode, track table position for window scroll
  useEffect(() => {
    if (isFullscreen) {
      return;
    }

    const updateTableOffset = () => {
      if (tbodyRef.current) {
        const rect = tbodyRef.current.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const offset = rect.top + scrollTop;
        tableOffsetTopRef.current = offset;
        setTableOffsetTop(offset);
      }
    };

    updateTableOffset();
    requestAnimationFrame(updateTableOffset);

    window.addEventListener('resize', updateTableOffset);

    return () => {
      window.removeEventListener('resize', updateTableOffset);
    };
  }, [isFullscreen]);

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
      const visibleFiles = getFilesVisibleForDownloadSearch(item, fileSearch);
      if (expandedSet.has(item.id) && visibleFiles.length > 0) {
        visibleFiles.forEach((file, fileIndex) => {
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
  }, [deferredItems, expandedItemsArray, fileSearch]);

  const downloadHistoryLookup = useMemo(() => {
    const itemDownloads = new Set();
    const fileDownloads = new Set();

    downloadHistory.forEach((download) => {
      const itemKey = `${download.assetType}:${String(download.itemId)}`;
      if (download.fileId == null) {
        itemDownloads.add(itemKey);
        return;
      }

      fileDownloads.add(`${itemKey}:${String(download.fileId)}`);
    });

    return { itemDownloads, fileDownloads };
  }, [downloadHistory]);

  // Memoize measureElement to prevent unnecessary re-renders
  const measureElement = useCallback((element) => {
    return Math.ceil(element.getBoundingClientRect().height);
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
      const isTablet =
        typeof window !== 'undefined' &&
        window.innerWidth >= 768 &&
        window.innerWidth < 1024;
      if (isTablet) {
        return row?.type === 'item' ? 52 : 42;
      }
      return row?.type === 'item' ? 58 : 48;
    },
    [flattenedRows, isMobile]
  );

  const getScrollElement = useCallback(() => fullscreenScrollEl, [fullscreenScrollEl]);

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
          getFilesVisibleForDownloadSearch(item, fileSearch)
            .slice(start, end + 1)
            .forEach((f) => {
              onFileSelect(itemId, f.id, checked);
            });
        }
      } else {
        onFileSelect(itemId, file.id, checked);
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

  // Track view mode / fullscreen changes to prevent flushSync errors
  const prevViewModeRef = useRef(viewMode);
  const prevIsFullscreenRef = useRef(isFullscreen);
  const isTransitioningRef = useRef(false);
  const [virtualRows, setVirtualRows] = useState([]);
  // Ref to latest virtualizer so effects don't depend on it (virtualizer reference changes every render)
  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  const syncVirtualRows = useCallback(() => {
    try {
      const rows = virtualizerRef.current.getVirtualItems();
      setVirtualRows((previousRows) => {
        if (
          previousRows.length === rows.length &&
          previousRows.every(
            (row, index) =>
              row.index === rows[index]?.index &&
              row.start === rows[index]?.start &&
              row.size === rows[index]?.size
          )
        ) {
          return previousRows;
        }

        return rows;
      });
    } catch (error) {
      // Silently handle errors and retry on the next sync event
    }
  }, []);

  const remeasureAndSync = useCallback(() => {
    try {
      virtualizerRef.current.measure?.();
    } catch (error) {
      // ignore
    }
    syncVirtualRows();
  }, [syncVirtualRows]);

  // Update virtual rows after render completes to prevent flushSync errors
  // This is critical when switching from Card to Table view or entering fullscreen
  useLayoutEffect(() => {
    const viewModeChanged = prevViewModeRef.current !== viewMode;
    const fullscreenChanged = prevIsFullscreenRef.current !== isFullscreen;
    prevViewModeRef.current = viewMode;
    prevIsFullscreenRef.current = isFullscreen;

    if (viewModeChanged || fullscreenChanged) {
      isTransitioningRef.current = true;
      setVirtualRows([]);
    }

    const rafId = requestAnimationFrame(() => {
      remeasureAndSync();
      isTransitioningRef.current = false;
    });
    return () => cancelAnimationFrame(rafId);
  }, [viewMode, flattenedRows.length, isFullscreen, fullscreenScrollEl, remeasureAndSync]);

  useLayoutEffect(() => {
    remeasureAndSync();
  }, [resolvedColumnWidths, tableOffsetTop, remeasureAndSync]);

  useEffect(() => {
    const scrollTarget = isFullscreen ? fullscreenScrollEl : window;
    if (!scrollTarget) {
      return;
    }

    let rafId = null;
    const scheduleSync = () => {
      if (isTransitioningRef.current || rafId !== null) {
        return;
      }

      rafId = requestAnimationFrame(() => {
        rafId = null;
        syncVirtualRows();
      });
    };

    scheduleSync();
    scrollTarget.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      scrollTarget.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
    };
  }, [isFullscreen, fullscreenScrollEl, flattenedRows.length, syncVirtualRows]);

  // Re-measure when the fullscreen scroll container resizes (e.g. fixed layout settling)
  useEffect(() => {
    if (!isFullscreen || !fullscreenScrollEl) {
      return;
    }

    const observer = new ResizeObserver(() => {
      remeasureAndSync();
    });
    observer.observe(fullscreenScrollEl);

    return () => observer.disconnect();
  }, [isFullscreen, fullscreenScrollEl, remeasureAndSync]);

  // Get virtual rows - always use state to prevent flushSync errors
  // State is updated in effects to keep it in sync with scroll
  const currentVirtualRows = virtualRows;

  const totalVirtualSize = virtualizer.getTotalSize();
  // useWindowVirtualizer bakes scrollMargin into item start; subtract it for tbody spacers (see CardList)
  const scrollMargin = isFullscreen ? 0 : tableOffsetTopRef.current || tableOffsetTop;
  const paddingTop =
    currentVirtualRows.length > 0
      ? Math.max(0, currentVirtualRows[0].start - scrollMargin)
      : 0;
  const lastVirtualRow = currentVirtualRows[currentVirtualRows.length - 1];
  const paddingBottom = lastVirtualRow ? totalVirtualSize - lastVirtualRow.end : 0;

  // Show empty state when there are no items
  if (deferredItems.length === 0) {
    return (
      <tbody
        ref={tbodyRef}
        className="bg-surface dark:bg-surface-dark"
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
      className="bg-surface dark:bg-surface-dark"
    >
      {/* Top spacer */}
      {paddingTop > 0 && (
        <tr aria-hidden="true">
          <td colSpan={activeColumns.length + 2} style={{ height: paddingTop, padding: 0, border: 0 }} />
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
                resolvedColumnWidths={resolvedColumnWidths}
                selectedItems={selectedItems}
                setItems={setItems}
                setSelectedItems={setSelectedItems}
                downloadHistory={downloadHistory}
                downloadHistoryLookup={downloadHistoryLookup}
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
                downloadHistoryLookup={downloadHistoryLookup}
                isCopying={isCopying}
                isDownloading={isDownloading}
                isStreaming={isStreaming}
                isMobile={isMobile}
                isBlurred={isBlurred}
                tableWidth={tableWidth}
                file={row.file}
                fileIndex={row.fileIndex}
                measureRef={virtualizer.measureElement}
                dataIndex={virtualRow.index}
                style={rowStyle}
              />
            );
          }
        })}
      {/* Bottom spacer */}
      {paddingBottom > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={activeColumns.length + 2}
            style={{ height: paddingBottom, padding: 0, border: 0 }}
          />
        </tr>
      )}
    </tbody>
  );
}

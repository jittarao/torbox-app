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
import DownloadRowContainer from './DownloadRowContainer';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { entityKey as toEntityKey } from '@/utils/downloadListMerge';
import FileRow from './FileRow';
import { useDownloadsActions } from './DownloadsActionsContext';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';
import { getFilesVisibleForDownloadSearch } from './utils/downloadSearch';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useDownloadsVirtualRowSync } from './hooks/useDownloadsVirtualRowSync';
import { useDownloadRowInteractions } from './hooks/useDownloadRowInteractions';

export default function TableBody({
  items,
  activeColumns,
  resolvedColumnWidths,
  selectedItems,
  onFileSelect,
  setSelectedItems,
  tagMappings,
  downloadHistoryLookup,
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

  const [isDownloading, setIsDownloading] = useState({});
  const [isCopying, setIsCopying] = useState({});
  const [isStreaming, setIsStreaming] = useState({});
  const { downloadSingle } = useDownloadsActions();
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
  const expandedById = useDownloadsUiStore((state) => state.expandedById);
  const deferredExpandedById = useDeferredValue(expandedById);

  const expandedItemsArray = useMemo(() => {
    return Object.keys(deferredExpandedById)
      .map((id) => (Number.isNaN(Number(id)) ? id : Number(id)))
      .sort((a, b) => String(a).localeCompare(String(b)));
  }, [deferredExpandedById]);

  // Create flattened array of rows (item rows + file rows when expanded)
  const flattenedRows = useMemo(() => {
    const rows = [];
    const expandedSet = new Set(expandedItemsArray);

    deferredItems.forEach((item, itemIndex) => {
      // Add item row
      rows.push({
        type: 'item',
        item,
        entityKey: getDownloadSelectionId(item),
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

  // Memoize measureElement to prevent unnecessary re-renders
  const measureElement = useCallback((element) => {
    return Math.ceil(element.getBoundingClientRect().height);
  }, []);

  // Memoize estimateSize to prevent recalculation on every render
  const estimateSize = useCallback(
    (index) => {
      const row = flattenedRows[index];
      // Height estimates for mobile vs desktop
      if (isMobile) {
        return row?.type === 'item' ? 100 : 60;
      }
      const isTablet =
        typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024;
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

  // Use the appropriate virtualizer based on mode
  const virtualizer = isFullscreen ? containerVirtualizer : windowVirtualizer;

  const toastMessages = useMemo(
    () => ({
      copyLinkSuccess: t('toast.copyLink'),
      copyLinkFailed: t('toast.copyLinkFailed'),
    }),
    [t]
  );

  const {
    handleItemSelection,
    handleFileSelection,
    handleFileDownload,
    isSelectionDisabled,
    assetKey,
    lastClickedItemIndexRef,
    lastClickedFileIndexRef,
  } = useDownloadRowInteractions({
    items,
    activeType,
    fileSearch,
    onFileSelect,
    downloadSingle,
    setToast,
    toastMessages,
    setIsDownloading,
    setIsCopying,
  });

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

  const expandedItemsKey = expandedItemsArray.join(',');

  const { virtualRows: currentVirtualRows } = useDownloadsVirtualRowSync({
    virtualizer,
    viewMode,
    isFullscreen,
    fullscreenScrollEl,
    rowCount: flattenedRows.length,
    remeasureDeps: [resolvedColumnWidths, tableOffsetTop, expandedItemsKey, fileSearch],
  });

  const totalVirtualSize = virtualizer.getTotalSize();
  // useWindowVirtualizer bakes scrollMargin into item start; subtract it for tbody spacers (see CardList)
  const scrollMargin = isFullscreen ? 0 : tableOffsetTopRef.current || tableOffsetTop;
  const paddingTop =
    currentVirtualRows.length > 0 ? Math.max(0, currentVirtualRows[0].start - scrollMargin) : 0;
  const lastVirtualRow = currentVirtualRows[currentVirtualRows.length - 1];
  const paddingBottom = lastVirtualRow ? totalVirtualSize - lastVirtualRow.end : 0;

  // Show empty state when there are no items
  if (deferredItems.length === 0) {
    return (
      <tbody ref={tbodyRef} className="bg-surface dark:bg-surface-dark">
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
    <tbody ref={tbodyRef} className="bg-surface dark:bg-surface-dark">
      {/* Top spacer */}
      {paddingTop > 0 && (
        <tr>
          <td
            colSpan={activeColumns.length + 2}
            style={{ height: paddingTop, padding: 0, border: 0 }}
          />
        </tr>
      )}
      {/* Virtualized rows */}
      {currentVirtualRows.flatMap((virtualRow) => {
        if (virtualRow.index < 0 || virtualRow.index >= flattenedRows.length) return [];

        const row = flattenedRows[virtualRow.index];

        if (row.type === 'item') {
          const rowEntityKey =
            row.entityKey ||
            toEntityKey(row.item.assetType || activeType, row.item.id);
          return (
            <DownloadRowContainer
              key={`item-${rowEntityKey}`}
              entityKey={rowEntityKey}
              tagMappings={tagMappings}
              activeColumns={activeColumns}
              resolvedColumnWidths={resolvedColumnWidths}
              downloadHistoryLookup={downloadHistoryLookup}
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
        <tr>
          <td
            colSpan={activeColumns.length + 2}
            style={{ height: paddingBottom, padding: 0, border: 0 }}
          />
        </tr>
      )}
    </tbody>
  );
}

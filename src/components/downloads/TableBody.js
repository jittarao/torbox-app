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

function useTableBodyState(props) {
  const {
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
  } = props;

  const t = useTranslations('TableBody');
  const [isDownloading, setIsDownloading] = useState({});
  const [isCopying, setIsCopying] = useState({});
  const [isStreaming, setIsStreaming] = useState({});
  const { downloadSingle } = useDownloadsActions();
  const isMobile = useIsMobile();
  const tbodyRef = useRef(null);
  const tableOffsetTopRef = useRef(0);
  const [tableOffsetTop, setTableOffsetTop] = useState(0);
  const [fullscreenScrollEl, setFullscreenScrollEl] = useState(null);

  useLayoutEffect(() => {
    if (isFullscreen) {
      setFullscreenScrollEl(scrollContainerRef?.current ?? null);
    } else {
      setFullscreenScrollEl(null);
    }
  }, [isFullscreen, scrollContainerRef]);

  useEffect(() => {
    if (isFullscreen) return;

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

  const deferredItems = useDeferredValue(items);
  const expandedById = useDownloadsUiStore((state) => state.expandedById);
  const deferredExpandedById = useDeferredValue(expandedById);

  const expandedItemsArray = useMemo(() => {
    return Object.keys(deferredExpandedById)
      .map((id) => (Number.isNaN(Number(id)) ? id : Number(id)))
      .sort((a, b) => String(a).localeCompare(String(b)));
  }, [deferredExpandedById]);

  const flattenedRows = useMemo(() => {
    const rows = [];
    const expandedSet = new Set(expandedItemsArray);

    deferredItems.forEach((item, itemIndex) => {
      rows.push({
        type: 'item',
        item,
        entityKey: getDownloadSelectionId(item),
        itemIndex,
        virtualIndex: rows.length,
      });

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

  const measureElement = useCallback((element) => {
    return Math.ceil(element.getBoundingClientRect().height);
  }, []);

  const estimateSize = useCallback(
    (index) => {
      const row = flattenedRows[index];
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

  const toastMessages = useMemo(
    () => ({
      copyLinkSuccess: t('toast.copyLink'),
      copyLinkFailed: t('toast.copyLinkFailed'),
    }),
    [t]
  );

  const interactions = useDownloadRowInteractions({
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
      const key = interactions.assetKey(itemId, file.id);
      setIsStreaming((prev) => ({ ...prev, [key]: true }));
      try {
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
    [interactions.assetKey, onFileStreamInit, setToast]
  );

  const handleAudioPlay = useCallback(
    async (itemId, file) => {
      const key = interactions.assetKey(itemId, file.id);
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
    [interactions.assetKey, onAudioPlay, setToast]
  );

  return {
    tbodyRef,
    tableOffsetTopRef,
    tableOffsetTop,
    fullscreenScrollEl,
    flattenedRows,
    measureElement,
    estimateSize,
    toastMessages,
    interactions,
    isDownloading,
    isCopying,
    isStreaming,
    setIsDownloading,
    setIsCopying,
    handleFileStream,
    handleAudioPlay,
    activeColumns,
    resolvedColumnWidths,
    selectedItems,
    tagMappings,
    downloadHistoryLookup,
    toggleFiles,
    apiKey,
    onDelete,
    setToast,
    activeType,
    isMobile,
    isBlurred,
    viewMode,
    tableWidth,
    fileSearch,
    t,
  };
}

function VirtualizedTableBodyInner({
  virtualizer,
  state,
  currentVirtualRows,
  scrollMargin,
}) {
  const totalVirtualSize = virtualizer.getTotalSize();
  const paddingTop =
    currentVirtualRows.length > 0
      ? Math.max(0, currentVirtualRows[0].start - scrollMargin)
      : 0;
  const lastVirtualRow = currentVirtualRows[currentVirtualRows.length - 1];
  const paddingBottom = lastVirtualRow ? totalVirtualSize - lastVirtualRow.end : 0;

  const rowStyle = { willChange: 'transform' };

  if (state.flattenedRows.length === 0) {
    return (
      <tbody ref={state.tbodyRef} className="bg-surface dark:bg-surface-dark">
        <tr>
          <td
            colSpan={state.activeColumns.length + 2}
            className="text-center py-8 text-text-secondary dark:text-text-secondary-dark"
          >
            {state.t('noDownloads')}
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody ref={state.tbodyRef} className="bg-surface dark:bg-surface-dark">
      {paddingTop > 0 && (
        <tr>
          <td
            colSpan={state.activeColumns.length + 2}
            style={{ height: paddingTop, padding: 0, border: 0 }}
          />
        </tr>
      )}
      {currentVirtualRows.flatMap((virtualRow) => {
        if (virtualRow.index < 0 || virtualRow.index >= state.flattenedRows.length) return [];

        const row = state.flattenedRows[virtualRow.index];

        if (row.type === 'item') {
          const rowEntityKey =
            row.entityKey ||
            toEntityKey(row.item.assetType || state.activeType, row.item.id);
          return (
            <DownloadRowContainer
              key={`item-${rowEntityKey}`}
              entityKey={rowEntityKey}
              tagMappings={state.tagMappings}
              activeColumns={state.activeColumns}
              resolvedColumnWidths={state.resolvedColumnWidths}
              downloadHistoryLookup={state.downloadHistoryLookup}
              toggleFiles={state.toggleFiles}
              apiKey={state.apiKey}
              onDelete={state.onDelete}
              rowIndex={row.itemIndex}
              handleItemSelection={state.interactions.handleItemSelection}
              setToast={state.setToast}
              activeType={state.activeType}
              isMobile={state.isMobile}
              isBlurred={state.isBlurred}
              viewMode={state.viewMode}
              tableWidth={state.tableWidth}
              measureRef={virtualizer.measureElement}
              dataIndex={virtualRow.index}
              style={rowStyle}
            />
          );
        }

        return (
          <FileRow
            key={`file-${row.item.id}-${row.file.id}`}
            item={row.item}
            handleFileSelection={state.interactions.handleFileSelection}
            handleFileDownload={state.interactions.handleFileDownload}
            handleFileStream={state.handleFileStream}
            handleAudioPlay={state.handleAudioPlay}
            activeColumns={state.activeColumns}
            downloadHistoryLookup={state.downloadHistoryLookup}
            isCopying={state.isCopying}
            isDownloading={state.isDownloading}
            isStreaming={state.isStreaming}
            isMobile={state.isMobile}
            isBlurred={state.isBlurred}
            tableWidth={state.tableWidth}
            file={row.file}
            fileIndex={row.fileIndex}
            measureRef={virtualizer.measureElement}
            dataIndex={virtualRow.index}
            style={rowStyle}
          />
        );
      })}
      {paddingBottom > 0 && (
        <tr>
          <td
            colSpan={state.activeColumns.length + 2}
            style={{ height: paddingBottom, padding: 0, border: 0 }}
          />
        </tr>
      )}
    </tbody>
  );
}

function WindowVirtualizedBody(props) {
  const state = useTableBodyState(props);

  const windowVirtualizer = useWindowVirtualizer({
    count: state.flattenedRows.length,
    estimateSize: state.estimateSize,
    measureElement: state.measureElement,
    overscan: 30,
    scrollMargin: state.tableOffsetTopRef.current || state.tableOffsetTop,
    useFlushSync: false,
  });

  const expandedItemsKey = Object.keys(useDownloadsUiStore.getState().expandedById)
    .sort()
    .join(',');

  const { virtualRows: currentVirtualRows } = useDownloadsVirtualRowSync({
    virtualizer: windowVirtualizer,
    viewMode: state.viewMode,
    isFullscreen: false,
    fullscreenScrollEl: null,
    rowCount: state.flattenedRows.length,
    remeasureDeps: [
      state.resolvedColumnWidths,
      state.tableOffsetTop,
      expandedItemsKey,
      state.fileSearch,
    ],
  });

  const scrollMargin = state.tableOffsetTopRef.current || state.tableOffsetTop;

  return (
    <VirtualizedTableBodyInner
      virtualizer={windowVirtualizer}
      state={state}
      currentVirtualRows={currentVirtualRows}
      scrollMargin={scrollMargin}
    />
  );
}

function ContainerVirtualizedBody(props) {
  const state = useTableBodyState(props);

  const getScrollElement = useCallback(
    () => state.fullscreenScrollEl,
    [state.fullscreenScrollEl]
  );

  const containerVirtualizer = useVirtualizer({
    count: state.flattenedRows.length,
    getScrollElement,
    estimateSize: state.estimateSize,
    measureElement: state.measureElement,
    overscan: 30,
    useFlushSync: false,
  });

  const expandedItemsKey = Object.keys(useDownloadsUiStore.getState().expandedById)
    .sort()
    .join(',');

  const { virtualRows: currentVirtualRows } = useDownloadsVirtualRowSync({
    virtualizer: containerVirtualizer,
    viewMode: state.viewMode,
    isFullscreen: true,
    fullscreenScrollEl: state.fullscreenScrollEl,
    rowCount: state.flattenedRows.length,
    remeasureDeps: [
      state.resolvedColumnWidths,
      state.tableOffsetTop,
      expandedItemsKey,
      state.fileSearch,
    ],
  });

  return (
    <VirtualizedTableBodyInner
      virtualizer={containerVirtualizer}
      state={state}
      currentVirtualRows={currentVirtualRows}
      scrollMargin={0}
    />
  );
}

export default function TableBody(props) {
  if (props.isFullscreen) {
    return <ContainerVirtualizedBody {...props} />;
  }
  return <WindowVirtualizedBody {...props} />;
}

'use client';

import {
  useRef,
  useMemo,
  useDeferredValue,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  memo,
} from 'react';
import { useWindowVirtualizer, useVirtualizer } from '@tanstack/react-virtual';
import DownloadRowContainer from './DownloadRowContainer';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import FileRow from './FileRow';
import { useDownloadsActions } from './DownloadsActionsContext';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';
import { getFilesVisibleForDownloadSearch } from './utils/downloadSearch';
import { buildFlattenedTableRows } from './utils/flattenTableRows';
import FileOverflowRow from './FileOverflowRow';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useDownloadsVirtualRowSync } from './hooks/useDownloadsVirtualRowSync';
import { useLayoutOnTabVisible } from './hooks/useLayoutOnTabVisible';
import { useDownloadRowInteractions } from './hooks/useDownloadRowInteractions';
import { useFileInteractionStore } from '@/store/fileInteractionStore';
import { TABLE_ROW_CONTENT_VISIBILITY } from './utils/tableConstants';

const VIRTUAL_ROW_STYLE = { willChange: 'transform' };

function useTableBodyState(props) {
  const {
    items,
    activeColumns,
    resolvedColumnWidths,
    resolvedColumnStyles,
    onFileSelect,
    setSelectedItems,
    tagMappings,
    protectedMap,
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
  const commonT = useTranslations('Common');
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

  const updateTableOffset = useCallback(() => {
    if (isFullscreen || !tbodyRef.current) return;

    const rect = tbodyRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const offset = rect.top + scrollTop;
    tableOffsetTopRef.current = offset;
    setTableOffsetTop(offset);
  }, [isFullscreen]);

  useEffect(() => {
    if (isFullscreen) return;

    updateTableOffset();
    requestAnimationFrame(updateTableOffset);
    window.addEventListener('resize', updateTableOffset);
    return () => {
      window.removeEventListener('resize', updateTableOffset);
    };
  }, [isFullscreen, updateTableOffset]);

  useLayoutOnTabVisible(updateTableOffset);

  const deferredItems = useDeferredValue(items);
  const expandedById = useDownloadsUiStore((state) => state.expandedById);
  const uncappedFileExpandById = useDownloadsUiStore((state) => state.uncappedFileExpandById);
  const deferredExpandedById = useDeferredValue(expandedById);
  const deferredUncappedFileExpandById = useDeferredValue(uncappedFileExpandById);

  const expandedItemsKey = useMemo(
    () => Object.keys(deferredExpandedById).sort().join(','),
    [deferredExpandedById]
  );

  const expandedItemsArray = useMemo(() => {
    return Object.keys(deferredExpandedById)
      .map((id) => (Number.isNaN(Number(id)) ? id : Number(id)))
      .sort((a, b) => String(a).localeCompare(String(b)));
  }, [deferredExpandedById]);

  const flattenedRows = useMemo(() => {
    const expandedSet = new Set(expandedItemsArray);
    return buildFlattenedTableRows(
      deferredItems,
      expandedSet,
      deferredUncappedFileExpandById,
      getFilesVisibleForDownloadSearch,
      fileSearch
    );
  }, [deferredItems, expandedItemsArray, deferredUncappedFileExpandById, fileSearch]);

  const measureElement = useCallback((element, _entry, instance) => {
    if (!element || !instance) return 0;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      const offsetHeight = element.offsetHeight;
      if (offsetHeight > 0) return Math.ceil(offsetHeight);
      const index = instance.indexFromElement(element);
      return instance.options.estimateSize(index);
    }
    const measured = Math.ceil(element.getBoundingClientRect().height);
    if (measured > 0) return measured;
    const offsetHeight = element.offsetHeight;
    if (offsetHeight > 0) return Math.ceil(offsetHeight);
    return instance.options.estimateSize(instance.indexFromElement(element));
  }, []);

  const estimateSize = useCallback(
    (index) => {
      const row = flattenedRows[index];
      if (row?.type === 'fileOverflow') {
        return isMobile ? 48 : 40;
      }
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
  });

  const handleFileStream = useCallback(
    (itemId, file, itemName) => {
      if (onFileStreamInit) {
        onFileStreamInit(itemId, file, itemName);
      }
    },
    [onFileStreamInit]
  );

  const handleAudioPlay = useCallback(
    async (itemId, file) => {
      const key = interactions.assetKey(itemId, file.id);
      useFileInteractionStore.getState().setStreaming(key, true);
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
        useFileInteractionStore.getState().setStreaming(key, false);
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
    handleFileStream,
    handleAudioPlay,
    activeColumns,
    resolvedColumnWidths,
    resolvedColumnStyles,
    tagMappings,
    protectedMap,
    downloadHistoryLookup,
    toggleFiles,
    apiKey,
    onDelete,
    setToast,
    activeType,
    isBlurred,
    viewMode,
    tableWidth,
    fileSearch,
    expandedItemsKey,
    t,
    commonT,
  };
}

const VirtualizedTableBodyInner = memo(function VirtualizedTableBodyInner({
  virtualizer,
  currentVirtualRows,
  scrollMargin,
  flattenedRows,
  activeColumns,
  resolvedColumnWidths,
  resolvedColumnStyles,
  tagMappings,
  protectedMap,
  downloadHistoryLookup,
  toggleFiles,
  apiKey,
  onDelete,
  setToast,
  activeType,
  isBlurred,
  viewMode,
  tableWidth,
  handleItemSelection,
  handleFileSelection,
  handleFileDownload,
  handleFileStream,
  handleAudioPlay,
  tbodyRef,
  t,
  commonT,
}) {
  const totalVirtualSize = virtualizer.getTotalSize();
  const paddingTop =
    currentVirtualRows.length > 0 ? Math.max(0, currentVirtualRows[0].start - scrollMargin) : 0;
  const lastVirtualRow = currentVirtualRows[currentVirtualRows.length - 1];
  const paddingBottom = lastVirtualRow ? totalVirtualSize - lastVirtualRow.end : 0;

  if (flattenedRows.length === 0) {
    return (
      <tbody
        ref={tbodyRef}
        className="bg-surface dark:bg-surface-dark"
        aria-label={t('downloadsTable')}
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
      aria-label={t('downloadsTable')}
    >
      {paddingTop > 0 && (
        <tr>
          <td
            colSpan={activeColumns.length + 2}
            style={{ height: paddingTop, padding: 0, border: 0 }}
          />
        </tr>
      )}
      {currentVirtualRows.flatMap((virtualRow) => {
        if (virtualRow.index < 0 || virtualRow.index >= flattenedRows.length) return [];

        const row = flattenedRows[virtualRow.index];

        if (row.type === 'item') {
          const rowEntityKey = row.entityKey;
          return (
            <DownloadRowContainer
              key={`item-${rowEntityKey}`}
              entityKey={rowEntityKey}
              tagMappings={tagMappings}
              protectedMap={protectedMap}
              activeColumns={activeColumns}
              resolvedColumnWidths={resolvedColumnWidths}
              resolvedColumnStyles={resolvedColumnStyles}
              downloadHistoryLookup={downloadHistoryLookup}
              toggleFiles={toggleFiles}
              apiKey={apiKey}
              onDelete={onDelete}
              rowIndex={row.itemIndex}
              handleItemSelection={handleItemSelection}
              setToast={setToast}
              activeType={activeType}
              isBlurred={isBlurred}
              viewMode={viewMode}
              tableWidth={tableWidth}
              measureRef={virtualizer.measureElement}
              dataIndex={virtualRow.index}
              commonT={commonT}
              style={VIRTUAL_ROW_STYLE}
              rowContentVisibility={TABLE_ROW_CONTENT_VISIBILITY}
            />
          );
        }

        if (row.type === 'fileOverflow') {
          return (
            <FileOverflowRow
              key={`overflow-${row.item.id}`}
              item={row.item}
              overflowCount={row.overflowCount}
              activeColumns={activeColumns}
              tableWidth={tableWidth}
            />
          );
        }

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
            isBlurred={isBlurred}
            tableWidth={tableWidth}
            file={row.file}
            fileIndex={row.fileIndex}
            measureRef={virtualizer.measureElement}
            dataIndex={virtualRow.index}
            style={VIRTUAL_ROW_STYLE}
          />
        );
      })}
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
});

function WindowVirtualizedBody(props) {
  const state = useTableBodyState(props);

  const windowVirtualizer = useWindowVirtualizer({
    count: state.flattenedRows.length,
    estimateSize: state.estimateSize,
    measureElement: state.measureElement,
    overscan: 10,
    scrollMargin: state.tableOffsetTopRef.current || state.tableOffsetTop,
    useFlushSync: false,
  });

  const { virtualRows: currentVirtualRows } = useDownloadsVirtualRowSync({
    virtualizer: windowVirtualizer,
    viewMode: state.viewMode,
    isFullscreen: false,
    fullscreenScrollEl: null,
    rowCount: state.flattenedRows.length,
    remeasureDeps: [
      state.resolvedColumnWidths,
      state.tableOffsetTop,
      state.expandedItemsKey,
      state.fileSearch,
    ],
  });

  const scrollMargin = state.tableOffsetTopRef.current || state.tableOffsetTop;

  return (
    <VirtualizedTableBodyInner
      virtualizer={windowVirtualizer}
      currentVirtualRows={currentVirtualRows}
      scrollMargin={scrollMargin}
      flattenedRows={state.flattenedRows}
      activeColumns={state.activeColumns}
      resolvedColumnWidths={state.resolvedColumnWidths}
      resolvedColumnStyles={state.resolvedColumnStyles}
      tagMappings={state.tagMappings}
      protectedMap={state.protectedMap}
      downloadHistoryLookup={state.downloadHistoryLookup}
      toggleFiles={state.toggleFiles}
      apiKey={state.apiKey}
      onDelete={state.onDelete}
      setToast={state.setToast}
      activeType={state.activeType}
      isBlurred={state.isBlurred}
      viewMode={state.viewMode}
      tableWidth={state.tableWidth}
      handleItemSelection={state.interactions.handleItemSelection}
      handleFileSelection={state.interactions.handleFileSelection}
      handleFileDownload={state.interactions.handleFileDownload}
      handleFileStream={state.handleFileStream}
      handleAudioPlay={state.handleAudioPlay}
      tbodyRef={state.tbodyRef}
      t={state.t}
      commonT={state.commonT}
    />
  );
}

function ContainerVirtualizedBody(props) {
  const state = useTableBodyState(props);

  const getScrollElement = useCallback(() => state.fullscreenScrollEl, [state.fullscreenScrollEl]);

  const containerVirtualizer = useVirtualizer({
    count: state.flattenedRows.length,
    getScrollElement,
    estimateSize: state.estimateSize,
    measureElement: state.measureElement,
    overscan: 10,
    useFlushSync: false,
  });

  const { virtualRows: currentVirtualRows } = useDownloadsVirtualRowSync({
    virtualizer: containerVirtualizer,
    viewMode: state.viewMode,
    isFullscreen: true,
    fullscreenScrollEl: state.fullscreenScrollEl,
    rowCount: state.flattenedRows.length,
    remeasureDeps: [
      state.resolvedColumnWidths,
      state.tableOffsetTop,
      state.expandedItemsKey,
      state.fileSearch,
    ],
  });

  return (
    <VirtualizedTableBodyInner
      virtualizer={containerVirtualizer}
      currentVirtualRows={currentVirtualRows}
      scrollMargin={0}
      flattenedRows={state.flattenedRows}
      activeColumns={state.activeColumns}
      resolvedColumnWidths={state.resolvedColumnWidths}
      resolvedColumnStyles={state.resolvedColumnStyles}
      tagMappings={state.tagMappings}
      protectedMap={state.protectedMap}
      downloadHistoryLookup={state.downloadHistoryLookup}
      toggleFiles={state.toggleFiles}
      apiKey={state.apiKey}
      onDelete={state.onDelete}
      setToast={state.setToast}
      activeType={state.activeType}
      isBlurred={state.isBlurred}
      viewMode={state.viewMode}
      tableWidth={state.tableWidth}
      handleItemSelection={state.interactions.handleItemSelection}
      handleFileSelection={state.interactions.handleFileSelection}
      handleFileDownload={state.interactions.handleFileDownload}
      handleFileStream={state.handleFileStream}
      handleAudioPlay={state.handleAudioPlay}
      tbodyRef={state.tbodyRef}
      t={state.t}
      commonT={state.commonT}
    />
  );
}

export default function TableBody(props) {
  if (props.isFullscreen) {
    return <ContainerVirtualizedBody {...props} />;
  }
  return <WindowVirtualizedBody {...props} />;
}

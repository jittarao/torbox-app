import {
  useRef,
  useState,
  useMemo,
  useDeferredValue,
  useCallback,
  useLayoutEffect,
} from 'react';
import { useDownloadsContext } from './DownloadsContext';
import useIsMobile from '@/hooks/useIsMobile';
import { useWindowVirtualizer, useVirtualizer } from '@tanstack/react-virtual';
import { useDownloadsActions } from './DownloadsActionsContext';
import { useStreamInitializer } from './hooks/useStreamInitializer';
import DownloadCardContainer from './DownloadCardContainer';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { getFilesVisibleForDownloadSearch } from './utils/downloadSearch';
import { useTranslations } from 'next-intl';
import TrackSelectionModal from './TrackSelectionModal';
import { cardListItemGap, getCardListItemGapPx } from './utils/responsiveLayout';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useDownloadsVirtualRowSync } from './hooks/useDownloadsVirtualRowSync';
import { useDownloadRowInteractions } from './hooks/useDownloadRowInteractions';

function parseEntityKey(entityKey) {
  const sep = entityKey.indexOf(':');
  if (sep === -1) return { assetType: 'torrents', id: entityKey };
  return { assetType: entityKey.slice(0, sep), id: entityKey.slice(sep + 1) };
}

function useCardEstimateSize(deferredEntityKeys, fileSearch) {
  const entities = useTorboxDownloadsStore((state) => state.entities);
  const expandedById = useDownloadsUiStore((state) => state.expandedById);
  const isMobile = useIsMobile();

  return useCallback(
    (index) => {
      const entityKey = deferredEntityKeys[index];
      if (!entityKey) return 0;
      const { id } = parseEntityKey(entityKey);
      const filesExpanded = expandedById[id];
      const entity = entities?.[entityKey];
      const filesVisible = getFilesVisibleForDownloadSearch(entity, fileSearch);

      let cardHeight = isMobile ? 118 : 104;
      if (filesExpanded && filesVisible) {
        const fileCount = filesVisible.length;
        cardHeight += fileCount * (isMobile ? 54 : 44);
      }
      cardHeight += cardListItemGap;
      return cardHeight;
    },
    [deferredEntityKeys, expandedById, entities, fileSearch, isMobile]
  );
}

function VirtualizedCardList({
  virtualizer,
  virtualRows,
  scrollMargin,
  deferredEntityKeys,
  parentRef,
  isFullscreen,
  renderCard,
}) {
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className={isFullscreen ? 'relative w-full' : 'relative w-full'}
      style={{ height: `${totalSize}px` }}
    >
      {virtualRows.map((virtualRow) => {
        const entityKey = deferredEntityKeys[virtualRow.index];
        if (!entityKey) return null;

        return (
          <div
            key={entityKey}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 w-full"
            style={{
              top: 0,
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
          >
            {renderCard(entityKey, virtualRow.index)}
          </div>
        );
      })}
    </div>
  );
}

/** Window scroll (normal layout — mobile and desktop card view). */
function CardListWindowVirtualized({
  deferredEntityKeys,
  entityKeys,
  containerOffsetTop,
  parentRef,
  viewMode,
  isFullscreen,
  estimateSize,
  renderCard,
  emptyState,
}) {
  const virtualizer = useWindowVirtualizer({
    count: deferredEntityKeys.length,
    estimateSize,
    overscan: 4,
    gap: getCardListItemGapPx(),
    scrollMargin: containerOffsetTop,
  });

  const { virtualRows } = useDownloadsVirtualRowSync({
    virtualizer,
    viewMode,
    isFullscreen: false,
    fullscreenScrollEl: null,
    rowCount: deferredEntityKeys.length,
    remeasureDeps: [containerOffsetTop, deferredEntityKeys],
  });

  useLayoutEffect(() => {
    if (entityKeys.length > 0 && entityKeys !== deferredEntityKeys) {
      virtualizer.measure();
    }
  }, [entityKeys, deferredEntityKeys, virtualizer]);

  if (deferredEntityKeys.length === 0) {
    return emptyState;
  }

  return (
    <VirtualizedCardList
      virtualizer={virtualizer}
      virtualRows={virtualRows}
      scrollMargin={containerOffsetTop}
      deferredEntityKeys={deferredEntityKeys}
      parentRef={parentRef}
      isFullscreen={isFullscreen}
      renderCard={renderCard}
    />
  );
}

/** Scroll container is the fullscreen downloads panel. */
function CardListContainerVirtualized({
  deferredEntityKeys,
  entityKeys,
  fullscreenScrollEl,
  parentRef,
  viewMode,
  isFullscreen,
  estimateSize,
  renderCard,
  emptyState,
}) {
  const getScrollElement = useCallback(() => fullscreenScrollEl, [fullscreenScrollEl]);

  const virtualizer = useVirtualizer({
    count: deferredEntityKeys.length,
    getScrollElement,
    estimateSize,
    overscan: 4,
    gap: getCardListItemGapPx(),
  });

  const { virtualRows } = useDownloadsVirtualRowSync({
    virtualizer,
    viewMode,
    isFullscreen: true,
    fullscreenScrollEl,
    rowCount: deferredEntityKeys.length,
    remeasureDeps: [deferredEntityKeys, fullscreenScrollEl],
  });

  useLayoutEffect(() => {
    if (entityKeys.length > 0 && entityKeys !== deferredEntityKeys) {
      virtualizer.measure();
    }
  }, [entityKeys, deferredEntityKeys, virtualizer]);

  if (deferredEntityKeys.length === 0) {
    return emptyState;
  }

  return (
    <VirtualizedCardList
      virtualizer={virtualizer}
      virtualRows={virtualRows}
      scrollMargin={0}
      deferredEntityKeys={deferredEntityKeys}
      parentRef={parentRef}
      isFullscreen={isFullscreen}
      renderCard={renderCard}
    />
  );
}

export default function CardList() {
  const ctx = useDownloadsContext();
  const {
    visibleIds: entityKeys,
    tagMappings = {},
    apiKey,
    activeColumns,
    handleFileSelect: onFileSelect,
    downloadHistoryLookup,
    deleteItem: onDelete,
    toggleFiles,
    setToast,
    activeType,
    isBlurred,
    isFullscreen,
    displayViewMode: viewMode,
    scrollContainerRef,
    onOpenVideoPlayer,
    onAudioPlay,
    fileSearch = '',
  } = ctx;

  const {
    trackSelectionModal,
    closeTrackSelectionModal,
    handleFileStreamInit: onFileStreamInit,
    handleTrackSelection,
  } = useStreamInitializer({ apiKey, activeType, onOpenVideoPlayer });

  const t = useTranslations('CardList');
  const [isDownloading, setIsDownloading] = useState({});
  const [isCopying, setIsCopying] = useState({});
  const [isStreaming, setIsStreaming] = useState({});
  const parentRef = useRef(null);
  const { downloadSingle } = useDownloadsActions();
  const containerOffsetTopRef = useRef(0);
  const [containerOffsetTop, setContainerOffsetTop] = useState(0);
  const [fullscreenScrollEl, setFullscreenScrollEl] = useState(null);

  useLayoutEffect(() => {
    if (isFullscreen) {
      setFullscreenScrollEl(scrollContainerRef?.current ?? null);
    } else {
      setFullscreenScrollEl(null);
    }
  }, [isFullscreen, scrollContainerRef]);

  useLayoutEffect(() => {
    if (isFullscreen) {
      containerOffsetTopRef.current = 0;
      setContainerOffsetTop(0);
      return;
    }

    const updateContainerOffset = () => {
      if (!parentRef.current) return;

      const rect = parentRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const offset = rect.top + scrollTop;

      if (offset !== containerOffsetTopRef.current) {
        containerOffsetTopRef.current = offset;
        setContainerOffsetTop(offset);
      }
    };

    updateContainerOffset();
    window.addEventListener('resize', updateContainerOffset);
    return () => window.removeEventListener('resize', updateContainerOffset);
  }, [isFullscreen, ctx.sortedItems]);

  const hasFilesWithSearch = useMemo(() => {
    if (!fileSearch) return null;
    const search = fileSearch.toLowerCase();
    return (item) => {
      if (!item.files || item.files.length === 0) return false;
      return item.files.some((file) => {
        const name = file.name || file.short_name || '';
        return name.toLowerCase().includes(search);
      });
    };
  }, [fileSearch]);

  const deferredEntityKeys = useDeferredValue(entityKeys);
  const estimateSize = useCardEstimateSize(deferredEntityKeys, fileSearch);

  const interactions = useDownloadRowInteractions({
    items: ctx.sortedItems,
    activeType,
    fileSearch,
    onFileSelect,
    setToast,
    downloadSingle,
    downloadHistoryLookup,
  });

  const handleFileStream = useCallback(
    async (itemId, file) => {
      const key = interactions.assetKey(itemId, file.id);
      setIsStreaming((prev) => ({ ...prev, [key]: true }));
      try {
        await onFileStreamInit(itemId, file);
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
        await onAudioPlay(itemId, file);
      } catch (error) {
        console.error('Error playing audio:', error);
        setToast({
          message: t('failedToPlay'),
          type: 'error',
        });
      } finally {
        setIsStreaming((prev) => ({ ...prev, [key]: false }));
      }
    },
    [interactions.assetKey, onAudioPlay, setToast, t]
  );

  const handleItemSelection = useCallback(
    (itemId, assetType) => {
      interactions.handleItemSelection(itemId, assetType);
    },
    [interactions]
  );

  const handleFileSelection = useCallback(
    (itemId, fileId) => {
      interactions.handleFileSelection(itemId, fileId);
    },
    [interactions]
  );

  const handleFileDownload = useCallback(
    async (itemId, fileId) => {
      setIsDownloading((prev) => ({ ...prev, [`${itemId}:${fileId}`]: true }));
      try {
        await interactions.handleFileDownload(itemId, fileId);
      } finally {
        setIsDownloading((prev) => ({ ...prev, [`${itemId}:${fileId}`]: false }));
      }
    },
    [interactions]
  );

  const handleCopyLink = useCallback(async (link) => {
    setIsCopying((prev) => ({ ...prev, [link]: true }));
    try {
      await navigator.clipboard.writeText(link);
    } finally {
      setTimeout(() => {
        setIsCopying((prev) => ({ ...prev, [link]: false }));
      }, 1000);
    }
  }, []);

  const renderCard = useCallback(
    (entityKey, index) => (
      <DownloadCardContainer
        entityKey={entityKey}
        index={index}
        tagMappings={tagMappings}
        apiKey={apiKey}
        activeColumns={activeColumns}
        isBlurred={isBlurred}
        viewMode={viewMode}
        toggleFiles={toggleFiles}
        setToast={setToast}
        onDelete={onDelete}
        downloadHistoryLookup={downloadHistoryLookup}
        selectedItems={ctx.selectedItems}
        handleItemSelection={handleItemSelection}
        handleFileSelection={handleFileSelection}
        handleFileDownload={handleFileDownload}
        handleFileStream={handleFileStream}
        handleAudioPlay={handleAudioPlay}
        handleCopyLink={handleCopyLink}
        isDownloading={isDownloading}
        isCopying={isCopying}
        isStreaming={isStreaming}
        activeType={activeType}
        hasFilesWithSearch={hasFilesWithSearch}
      />
    ),
    [
      tagMappings,
      apiKey,
      activeColumns,
      isBlurred,
      viewMode,
      toggleFiles,
      setToast,
      onDelete,
      downloadHistoryLookup,
      ctx.selectedItems,
      handleItemSelection,
      handleFileSelection,
      handleFileDownload,
      handleFileStream,
      handleAudioPlay,
      handleCopyLink,
      isDownloading,
      isCopying,
      isStreaming,
      activeType,
      hasFilesWithSearch,
    ]
  );

  const emptyState = (
    <div className="flex justify-center items-center py-12 text-primary-text/50 dark:text-primary-text-dark/50">
      {t('noItems')}
    </div>
  );

  const useContainerScroll = isFullscreen && fullscreenScrollEl;

  return (
    <>
      {useContainerScroll ? (
        <CardListContainerVirtualized
          deferredEntityKeys={deferredEntityKeys}
          entityKeys={entityKeys}
          fullscreenScrollEl={fullscreenScrollEl}
          parentRef={parentRef}
          viewMode={viewMode}
          isFullscreen={isFullscreen}
          estimateSize={estimateSize}
          renderCard={renderCard}
          emptyState={emptyState}
        />
      ) : (
        <CardListWindowVirtualized
          deferredEntityKeys={deferredEntityKeys}
          entityKeys={entityKeys}
          containerOffsetTop={containerOffsetTop}
          parentRef={parentRef}
          viewMode={viewMode}
          isFullscreen={isFullscreen}
          estimateSize={estimateSize}
          renderCard={renderCard}
          emptyState={emptyState}
        />
      )}
      <TrackSelectionModal
        isOpen={trackSelectionModal.isOpen}
        onClose={closeTrackSelectionModal}
        onPlay={handleTrackSelection}
        metadata={trackSelectionModal.metadata}
        introInformation={trackSelectionModal.introInformation}
        fileName={trackSelectionModal.fileName}
      />
    </>
  );
}

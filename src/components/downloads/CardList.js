import { useRef, useState, useMemo, useDeferredValue, useCallback, useLayoutEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDownloadsDataContext } from './DownloadsDataContext';
import { useDownloadsFilterContext } from './DownloadsFilterContext';
import { useDownloadsUIContext } from './DownloadsUIContext';
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
import { getCardListItemGapPx } from './utils/responsiveLayout';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useDownloadsVirtualRowSync } from './hooks/useDownloadsVirtualRowSync';
import { useLayoutOnTabVisible } from './hooks/useLayoutOnTabVisible';
import { useDownloadRowInteractions } from './hooks/useDownloadRowInteractions';
import { useFileInteractionStore } from '@/store/fileInteractionStore';

function parseEntityKey(entityKey) {
  const sep = entityKey.indexOf(':');
  if (sep === -1) return { assetType: 'torrents', id: entityKey };
  return { assetType: entityKey.slice(0, sep), id: entityKey.slice(sep + 1) };
}

function useCardEstimateSize(deferredEntityKeys, fileSearch) {
  const entities = useTorboxDownloadsStore(
    useShallow((state) => {
      const slice = {};
      for (let i = 0; i < deferredEntityKeys.length; i++) {
        const key = deferredEntityKeys[i];
        const row = state.entities[key];
        if (row) slice[key] = row;
      }
      return slice;
    })
  );
  const expandedById = useDownloadsUiStore((state) => state.expandedById);
  const isMobile = useIsMobile();
  const itemGap = getCardListItemGapPx();
  const lastIndex = deferredEntityKeys.length - 1;

  return useCallback(
    (index) => {
      const entityKey = deferredEntityKeys[index];
      if (!entityKey) return 0;
      const { id } = parseEntityKey(entityKey);
      const filesExpanded = expandedById[id];
      const entity = entities[entityKey];
      const filesVisible = getFilesVisibleForDownloadSearch(entity, fileSearch);

      let cardHeight = isMobile ? 152 : 100;
      if (filesExpanded && filesVisible) {
        const fileCount = filesVisible.length;
        cardHeight += fileCount * (isMobile ? 54 : 44);
      }
      if (index < lastIndex) {
        cardHeight += itemGap;
      }
      return cardHeight;
    },
    [deferredEntityKeys, expandedById, entities, fileSearch, isMobile, itemGap, lastIndex]
  );
}

function measureCardElement(element, _entry, instance) {
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
}

function VirtualizedCardList({
  virtualizer,
  virtualRows,
  scrollMargin,
  deferredEntityKeys,
  parentRef,
  renderCard,
}) {
  const totalSize = virtualizer.getTotalSize();
  const itemGap = getCardListItemGapPx();
  const lastIndex = deferredEntityKeys.length - 1;

  const paddingTop = virtualRows.length > 0 ? Math.max(0, virtualRows[0].start - scrollMargin) : 0;
  const lastVirtualRow = virtualRows[virtualRows.length - 1];
  const paddingBottom = lastVirtualRow ? Math.max(0, totalSize - lastVirtualRow.end) : 0;

  return (
    <div ref={parentRef} className="relative w-full" style={{ height: `${totalSize}px` }}>
      {paddingTop > 0 && <div aria-hidden style={{ height: paddingTop }} />}
      {virtualRows.map((virtualRow) => {
        const entityKey = deferredEntityKeys[virtualRow.index];
        if (!entityKey) return null;

        return (
          <div
            key={entityKey}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="w-full box-border"
            style={virtualRow.index < lastIndex ? { paddingBottom: itemGap } : undefined}
          >
            {renderCard(entityKey, virtualRow.index)}
          </div>
        );
      })}
      {paddingBottom > 0 && <div aria-hidden style={{ height: paddingBottom }} />}
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
    measureElement: measureCardElement,
    overscan: 4,
    scrollMargin: containerOffsetTop,
  });

  const expandedById = useDownloadsUiStore((state) => state.expandedById);

  const { virtualRows, remeasureAndSync } = useDownloadsVirtualRowSync({
    virtualizer,
    viewMode,
    isFullscreen: false,
    fullscreenScrollEl: null,
    rowCount: deferredEntityKeys.length,
    remeasureDeps: [containerOffsetTop, deferredEntityKeys, expandedById],
  });

  useLayoutEffect(() => {
    if (entityKeys.length > 0 && entityKeys !== deferredEntityKeys) {
      virtualizer.measure();
    }
  }, [entityKeys, deferredEntityKeys, virtualizer]);

  useLayoutEffect(() => {
    remeasureAndSync();
  }, [expandedById, remeasureAndSync]);

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
    measureElement: measureCardElement,
    overscan: 4,
  });

  const expandedById = useDownloadsUiStore((state) => state.expandedById);

  const { virtualRows, remeasureAndSync } = useDownloadsVirtualRowSync({
    virtualizer,
    viewMode,
    isFullscreen: true,
    fullscreenScrollEl,
    rowCount: deferredEntityKeys.length,
    remeasureDeps: [deferredEntityKeys, fullscreenScrollEl, expandedById],
  });

  useLayoutEffect(() => {
    if (entityKeys.length > 0 && entityKeys !== deferredEntityKeys) {
      virtualizer.measure();
    }
  }, [entityKeys, deferredEntityKeys, virtualizer]);

  useLayoutEffect(() => {
    remeasureAndSync();
  }, [expandedById, remeasureAndSync]);

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
      renderCard={renderCard}
    />
  );
}

export default function CardList() {
  const {
    visibleIds: entityKeys,
    sortedItems,
    tagMappings = {},
    activeColumns,
    downloadHistoryLookup,
  } = useDownloadsDataContext();
  const { search: fileSearch = '' } = useDownloadsFilterContext();

  const {
    activeType,
    isBlurred,
    isFullscreen,
    displayViewMode: viewMode,
    scrollContainerRef,
  } = useDownloadsUIContext();

  const {
    apiKey,
    handleFileSelect: onFileSelect,
    deleteItem: onDelete,
    toggleFiles,
    setToast,
    onOpenVideoPlayer,
    onAudioPlay,
  } = useDownloadsContext();

  const {
    trackSelectionModal,
    closeTrackSelectionModal,
    handleFileStreamInit: onFileStreamInit,
    handleTrackSelection,
  } = useStreamInitializer({ apiKey, activeType, onOpenVideoPlayer });

  const t = useTranslations('CardList');
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

  const updateContainerOffset = useCallback(() => {
    if (isFullscreen || !parentRef.current) return;

    const rect = parentRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const offset = rect.top + scrollTop;

    if (offset !== containerOffsetTopRef.current) {
      containerOffsetTopRef.current = offset;
      setContainerOffsetTop(offset);
    }
  }, [isFullscreen]);

  useLayoutEffect(() => {
    if (isFullscreen) {
      containerOffsetTopRef.current = 0;
      setContainerOffsetTop(0);
      return;
    }

    updateContainerOffset();
    window.addEventListener('resize', updateContainerOffset);
    return () => window.removeEventListener('resize', updateContainerOffset);
  }, [isFullscreen, sortedItems, updateContainerOffset]);

  useLayoutOnTabVisible(updateContainerOffset);

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

  const toastMessages = useMemo(
    () => ({
      copyLinkSuccess: t('toast.copyLink'),
      copyLinkFailed: t('toast.copyLinkFailed'),
    }),
    [t]
  );

  const interactions = useDownloadRowInteractions({
    items: sortedItems,
    entityKeys: deferredEntityKeys,
    activeType,
    fileSearch,
    onFileSelect,
    downloadSingle,
    setToast,
    toastMessages,
  });

  const handleFileStream = useCallback(
    async (itemId, file) => {
      const key = interactions.assetKey(itemId, file.id);
      useFileInteractionStore.getState().setStreaming(key, true);
      try {
        await onFileStreamInit(itemId, file);
      } catch (error) {
        console.error('Error initiating stream:', error);
        setToast({
          message: error.message || 'Failed to initiate stream',
          type: 'error',
        });
      } finally {
        useFileInteractionStore.getState().setStreaming(key, false);
      }
    },
    [interactions.assetKey, onFileStreamInit, setToast]
  );

  const handleAudioPlay = useCallback(
    async (itemId, file) => {
      const key = interactions.assetKey(itemId, file.id);
      useFileInteractionStore.getState().setStreaming(key, true);
      try {
        await onAudioPlay(itemId, file);
      } catch (error) {
        console.error('Error playing audio:', error);
        setToast({
          message: t('failedToPlay'),
          type: 'error',
        });
      } finally {
        useFileInteractionStore.getState().setStreaming(key, false);
      }
    },
    [interactions.assetKey, onAudioPlay, setToast, t]
  );

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
        handleItemSelection={interactions.handleItemSelection}
        handleFileSelection={interactions.handleFileSelection}
        handleFileDownload={interactions.handleFileDownload}
        handleFileStream={handleFileStream}
        handleAudioPlay={handleAudioPlay}
        activeType={activeType}
        fileSearch={fileSearch}
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
      interactions,
      handleFileStream,
      handleAudioPlay,
      activeType,
      fileSearch,
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

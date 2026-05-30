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
  const isMobile = useIsMobile();
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

  const entities = useTorboxDownloadsStore((state) => state.entities);
  const expandedById = useDownloadsUiStore((state) => state.expandedById);
  const { toggleExpanded } = useDownloadsUiStore.getState();

  const rowVirtualizer = (() => {
    if (deferredEntityKeys.length === 0) return null;

    const common = {
      count: deferredEntityKeys.length,
      estimateSize: (index) => {
        const entityKey = deferredEntityKeys[index];
        if (!entityKey) return 0;
        const { id } = parseEntityKey(entityKey);
        const filesExpanded = expandedById[id];
        const files = entities?.[id]?.files;
        const filesVisible = getFilesVisibleForDownloadSearch(files, fileSearch);

        let cardHeight = isMobile ? 118 : 104;
        if (filesExpanded && filesVisible) {
          const fileCount = filesVisible.length;
          cardHeight += fileCount * (isMobile ? 54 : 44);
        }
        cardHeight += cardListItemGap;
        return cardHeight;
      },
      overscan: 4,
      gap: getCardListItemGapPx(),
    };

    if (isFullscreen && fullscreenScrollEl) {
      return useWindowVirtualizer({
        ...common,
        scrollMargin: containerOffsetTop,
      });
    }

    return useVirtualizer({
      ...common,
      getScrollElement: () => parentRef.current,
    });
  })();

  useDownloadsVirtualRowSync(entityKeys, rowVirtualizer);

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

  const handleCopyLink = useCallback(
    async (link) => {
      setIsCopying((prev) => ({ ...prev, [link]: true }));
      try {
        await navigator.clipboard.writeText(link);
      } finally {
        setTimeout(() => {
          setIsCopying((prev) => ({ ...prev, [link]: false }));
        }, 1000);
      }
    },
    []
  );

  useLayoutEffect(() => {
    if (rowVirtualizer && entityKeys.length > 0 && entityKeys !== deferredEntityKeys) {
      rowVirtualizer.measure();
    }
  }, [entityKeys, deferredEntityKeys, rowVirtualizer]);

  return (
    <>
      <div
        ref={parentRef}
        className={isFullscreen ? '' : 'relative overflow-auto'}
        style={
          isFullscreen
            ? undefined
            : { height: `${rowVirtualizer?.getTotalSize?.() ?? 0}px` }
        }
      >
        {rowVirtualizer && deferredEntityKeys.length > 0 ? (
          <div
            style={
              isFullscreen
                ? {
                    position: 'relative',
                    width: '100%',
                    height: `${rowVirtualizer.getTotalSize()}px`,
                  }
                : undefined
            }
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const entityKey = deferredEntityKeys[virtualRow.index];
              if (!entityKey) return null;
              const { assetType, id } = parseEntityKey(entityKey);
              const item = entities?.[id];
              if (!item) return null;

              return (
                <DownloadCardContainer
                  key={entityKey}
                  entityKey={entityKey}
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
                  rowVirtualizer={rowVirtualizer}
                  virtualRow={virtualRow}
                  hasFilesWithSearch={hasFilesWithSearch}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex justify-center items-center py-12 text-primary-text/50 dark:text-primary-text-dark/50">
            {t('noItems')}
          </div>
        )}
      </div>
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

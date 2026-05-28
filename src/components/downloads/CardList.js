import {
  useRef,
  useState,
  useMemo,
  useDeferredValue,
  useCallback,
  useEffect,
  useLayoutEffect,
} from 'react';
import useIsMobile from '@/hooks/useIsMobile';
import { useWindowVirtualizer, useVirtualizer } from '@tanstack/react-virtual';
import { useDownloadsActions } from './DownloadsActionsContext';
import { useStream } from '../shared/hooks/useStream';
import ItemCard from './ItemCard';
import { useTranslations } from 'next-intl';
import TrackSelectionModal from './TrackSelectionModal';
import { cardListItemGap, getCardListItemGapPx } from './utils/responsiveLayout';
import { getFilesVisibleForDownloadSearch } from './utils/downloadSearch';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useDownloadsVirtualRowSync } from './hooks/useDownloadsVirtualRowSync';
import { useDownloadRowInteractions } from './hooks/useDownloadRowInteractions';

export default function CardList({
  items,
  selectedItems,
  setSelectedItems,
  apiKey,
  activeColumns,
  onFileSelect,
  downloadHistoryLookup,
  onDelete,
  toggleFiles,
  setToast,
  activeType,
  isBlurred,
  isFullscreen,
  viewMode = 'card',
  scrollContainerRef,
  onOpenVideoPlayer,
  onAudioPlay,
  fileSearch = '',
}) {
  const t = useTranslations('CardList');
  const [isDownloading, setIsDownloading] = useState({});
  const [isCopying, setIsCopying] = useState({});
  const [isStreaming, setIsStreaming] = useState({});
  const [trackSelectionModal, setTrackSelectionModal] = useState({
    isOpen: false,
    metadata: null,
    introInformation: null,
    fileName: null,
    itemId: null,
    fileId: null,
    file: null,
  });
  const parentRef = useRef(null);
  const { downloadSingle } = useDownloadsActions();
  const { createStream } = useStream(apiKey);
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

  // Measure list offset before paint so scrollMargin matches container position (table→card switch)
  useLayoutEffect(() => {
    if (isFullscreen) {
      containerOffsetTopRef.current = 0;
      setContainerOffsetTop(0);
      return;
    }

    const updateContainerOffset = () => {
      if (!parentRef.current) {
        return;
      }

      const rect = parentRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const offset = rect.top + scrollTop;

      if (offset !== containerOffsetTopRef.current) {
        containerOffsetTopRef.current = offset;
        setContainerOffsetTop(offset);
      }
    };

    updateContainerOffset();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateContainerOffset) : null;
    if (resizeObserver && parentRef.current) {
      resizeObserver.observe(parentRef.current);
    }

    window.addEventListener('resize', updateContainerOffset);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateContainerOffset);
    };
  }, [isFullscreen, viewMode]);

  // Defer items update to prevent synchronous updates during render
  const deferredItems = useDeferredValue(items);
  const expandedById = useDownloadsUiStore((state) => state.expandedById);
  const deferredExpandedById = useDeferredValue(expandedById);

  const expandedItemsSet = useMemo(() => {
    return new Set(
      Object.keys(deferredExpandedById).map((id) =>
        Number.isNaN(Number(id)) ? id : Number(id)
      )
    );
  }, [deferredExpandedById]);

  const flattenedRows = useMemo(() => {
    return deferredItems.map((item, itemIndex) => ({
      item,
      itemIndex,
    }));
  }, [deferredItems]);

  // Include margin-bottom (cardListItemGap) so variable-height cards stack with correct spacing
  const measureElement = useCallback((element) => {
    const marginBottom = parseFloat(window.getComputedStyle(element).marginBottom) || 0;
    return Math.ceil(element.getBoundingClientRect().height + marginBottom);
  }, []);

  const estimateSize = useCallback(
    (index) => {
      const row = flattenedRows[index];
      const isTablet =
        typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024;
      const gap = getCardListItemGapPx();
      const baseHeight = isMobile ? 118 : isTablet ? 74 : 82;
      if (!row) {
        return baseHeight + gap;
      }

      const visibleFiles = getFilesVisibleForDownloadSearch(row.item, fileSearch);
      if (expandedItemsSet.has(row.item.id) && visibleFiles.length > 0) {
        const fileRowHeight = isMobile ? 72 : 48;
        const fileListHeader = 32;
        return baseHeight + fileListHeader + visibleFiles.length * fileRowHeight + gap;
      }

      return baseHeight + gap;
    },
    [flattenedRows, expandedItemsSet, isMobile, fileSearch]
  );

  // Use different virtualizers based on fullscreen mode
  // In fullscreen: use useVirtualizer with scroll container
  // In normal mode: use useWindowVirtualizer for window scroll
  // Disabled useFlushSync to allow React to batch updates for better performance
  const windowVirtualizer = useWindowVirtualizer({
    count: flattenedRows.length,
    estimateSize,
    measureElement,
    overscan: 30,
    scrollMargin: containerOffsetTop,
    useFlushSync: false, // Allow React to batch updates for smoother fast scrolling
  });

  const getScrollElement = useCallback(() => fullscreenScrollEl, [fullscreenScrollEl]);

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

  // Map activeType to stream type
  const getStreamType = useCallback(() => {
    switch (activeType) {
      case 'usenet':
        return 'usenet';
      case 'webdl':
        return 'webdownload';
      default:
        return 'torrent';
    }
  }, [activeType]);

  const handleFileStream = useCallback(
    async (itemId, file) => {
      const key = assetKey(itemId, file.id);
      setIsStreaming((prev) => ({ ...prev, [key]: true }));

      try {
        const streamType = getStreamType();

        // Get stream metadata first using createStream with itemId, fileId, and type
        const streamData = await createStream(itemId, file.id, streamType);

        // Extract metadata - API returns data nested in 'data' property
        const data = streamData.data || streamData;
        const metadata = data.metadata || streamData.metadata || {};
        const introInformation = data.intro_information || streamData.intro_information || null;

        // Include search_metadata in the metadata object if it exists
        const fullMetadata = {
          ...metadata,
          search_metadata: data.search_metadata || streamData.search_metadata || null,
        };

        // Show track selection modal
        setTrackSelectionModal({
          isOpen: true,
          metadata: fullMetadata,
          introInformation: introInformation,
          fileName: file.name || file.short_name || 'Video',
          itemId: itemId,
          fileId: file.id,
          file: file,
        });
      } catch (error) {
        console.error('Error getting stream metadata:', error);
        setToast({
          message: error.message || 'Failed to get stream metadata',
          type: 'error',
        });
      } finally {
        setIsStreaming((prev) => ({ ...prev, [key]: false }));
      }
    },
    [assetKey, getStreamType, createStream, setToast]
  );

  // Handle track selection and open video player
  const handleTrackSelection = useCallback(
    async (selectedStreamData) => {
      const {
        itemId,
        fileId,
        file,
        metadata: fullMetadata,
        introInformation,
      } = trackSelectionModal;
      const streamType = getStreamType();
      const key = assetKey(itemId, fileId);

      setIsStreaming((prev) => ({ ...prev, [key]: true }));
      setTrackSelectionModal((prev) => ({ ...prev, isOpen: false }));

      try {
        // Create stream with selected tracks
        const streamMetadata = await createStream(
          itemId,
          fileId,
          streamType,
          selectedStreamData.subtitle_track_idx,
          selectedStreamData.audio_track_idx
        );

        // Extract stream URL
        const data = streamMetadata.data || streamMetadata;
        const presignedToken = data.presigned_token || streamMetadata.presigned_token;
        const userToken =
          data.user_token || data.token || streamMetadata.user_token || streamMetadata.token;

        // Check if hls_url is already provided in the response
        let streamUrl = data.hls_url || streamMetadata.hls_url;

        // If hls_url not provided, get it via createStream
        if (!streamUrl && presignedToken && userToken) {
          const streamData = await createStream(
            itemId,
            fileId,
            streamType,
            selectedStreamData.subtitle_track_idx,
            selectedStreamData.audio_track_idx
          );
          streamUrl = streamData.data.hls_url;
        }

        if (!streamUrl) {
          throw new Error('Failed to get stream URL');
        }

        // Extract updated metadata and subtitles/audios
        const updatedMetadata = data.metadata || streamMetadata.metadata || fullMetadata;
        const subtitles = updatedMetadata.subtitles || [];
        const audios = updatedMetadata.audios || [];

        const finalMetadata = {
          ...updatedMetadata,
          search_metadata:
            data.search_metadata ||
            streamMetadata.search_metadata ||
            fullMetadata?.search_metadata ||
            null,
        };

        // Open video player modal via callback
        if (onOpenVideoPlayer) {
          onOpenVideoPlayer(
            streamUrl,
            file.name || file.short_name || 'Video',
            subtitles,
            audios,
            finalMetadata,
            itemId,
            fileId,
            streamType,
            introInformation, // Pass intro information
            selectedStreamData.audio_track_idx, // Pass initial audio track index
            selectedStreamData.subtitle_track_idx // Pass initial subtitle track index
          );
        }
      } catch (error) {
        console.error('Error creating stream with selected tracks:', error);
        setToast({
          message: error.message || 'Failed to create stream',
          type: 'error',
        });
      } finally {
        setIsStreaming((prev) => ({ ...prev, [key]: false }));
      }
    },
    [trackSelectionModal, getStreamType, createStream, assetKey, setToast, onOpenVideoPlayer]
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

  // Create a lookup map for efficient item assetType retrieval
  const itemAssetTypeMap = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      map.set(String(item.id), item.assetType);
    });
    return map;
  }, [items]);

  const isItemDownloaded = (itemId) => {
    const itemAssetType = itemAssetTypeMap.get(String(itemId));
    return downloadHistoryLookup.itemDownloads.has(`${itemAssetType}:${String(itemId)}`);
  };

  const isFileDownloaded = (itemId, fileId) => {
    const itemAssetType = itemAssetTypeMap.get(String(itemId));
    const itemKey = `${itemAssetType}:${String(itemId)}`;
    return (
      downloadHistoryLookup.itemDownloads.has(itemKey) ||
      downloadHistoryLookup.fileDownloads.has(`${itemKey}:${String(fileId)}`)
    );
  };

  const expandedItemsKey = useMemo(
    () => Object.keys(deferredExpandedById).sort().join(','),
    [deferredExpandedById]
  );

  const { virtualRows: currentVirtualRows } = useDownloadsVirtualRowSync({
    virtualizer,
    viewMode,
    isFullscreen,
    fullscreenScrollEl,
    rowCount: flattenedRows.length,
    remeasureDeps: [containerOffsetTop, expandedItemsKey, fileSearch],
  });
  const totalVirtualSize = virtualizer.getTotalSize();
  // useWindowVirtualizer bakes scrollMargin into item start; subtract for top spacer (see TableBody)
  const scrollMargin = isFullscreen ? 0 : containerOffsetTopRef.current || containerOffsetTop;
  const paddingTop =
    currentVirtualRows.length > 0
      ? Math.max(0, currentVirtualRows[0].start - scrollMargin)
      : 0;
  const lastVirtualRow = currentVirtualRows[currentVirtualRows.length - 1];
  const paddingBottom = lastVirtualRow ? totalVirtualSize - lastVirtualRow.end : 0;

  return (
    <>
      <div ref={parentRef} className={isFullscreen ? 'p-4' : 'p-0'}>
        {paddingTop > 0 && <div aria-hidden style={{ height: paddingTop }} />}
        {currentVirtualRows.flatMap((virtualRow) => {
          if (virtualRow.index < 0 || virtualRow.index >= flattenedRows.length) return [];

          const row = flattenedRows[virtualRow.index];

          if (!row || !row.item) return [];

          return (
            <div
              key={`item-${row.item.id}`}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className={cardListItemGap}
            >
              <ItemCard
                item={row.item}
                index={row.itemIndex}
                isItemDownloaded={isItemDownloaded}
                isFileDownloaded={isFileDownloaded}
                isBlurred={isBlurred}
                activeColumns={activeColumns}
                onItemSelect={handleItemSelection}
                onFileSelect={handleFileSelection}
                onFileDownload={handleFileDownload}
                onFileStream={handleFileStream}
                onAudioPlay={handleAudioPlay}
                onDelete={onDelete}
                toggleFiles={toggleFiles}
                fileSearch={fileSearch}
                setToast={setToast}
                activeType={activeType}
                viewMode={viewMode}
                isCopying={isCopying}
                isDownloading={isDownloading}
                isStreaming={isStreaming}
                apiKey={apiKey}
              />
            </div>
          );
        })}
        {paddingBottom > 0 && <div aria-hidden style={{ height: paddingBottom }} />}
      </div>
      <TrackSelectionModal
        isOpen={trackSelectionModal.isOpen}
        onClose={() => setTrackSelectionModal((prev) => ({ ...prev, isOpen: false }))}
        onPlay={handleTrackSelection}
        metadata={trackSelectionModal.metadata}
        introInformation={trackSelectionModal.introInformation}
        fileName={trackSelectionModal.fileName}
      />
    </>
  );
}

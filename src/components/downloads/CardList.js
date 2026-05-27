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
import { useDownloads } from '../shared/hooks/useDownloads';
import { useStream } from '../shared/hooks/useStream';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import ItemCard from './ItemCard';
import { useTranslations } from 'next-intl';
import TrackSelectionModal from './TrackSelectionModal';
import { cardListItemGap, getCardListItemGapPx } from './utils/responsiveLayout';
import { getFilesVisibleForDownloadSearch } from './utils/downloadSearch';

export default function CardList({
  items,
  selectedItems,
  setSelectedItems,
  setItems,
  apiKey,
  activeColumns,
  onFileSelect,
  downloadHistory,
  onDelete,
  expandedItems,
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
  const lastClickedItemIndexRef = useRef(null);
  const lastClickedFileIndexRef = useRef(null);
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
  const fetchDownloadHistory = useDownloadHistoryStore((state) => state.fetchDownloadHistory);
  const { downloadSingle } = useDownloads(
    apiKey,
    activeType,
    downloadHistory,
    fetchDownloadHistory
  );
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

  const expandedItemsArray = useMemo(() => {
    return Array.from(expandedItems).sort();
  }, [expandedItems]);

  const expandedItemsSet = useMemo(() => new Set(expandedItemsArray), [expandedItemsArray]);

  const flattenedRows = useMemo(() => {
    return deferredItems.map((item, itemIndex) => ({
      item,
      itemIndex,
    }));
  }, [deferredItems]);

  // Memoize measureElement to prevent unnecessary re-renders
  const measureElement = useCallback((element) => {
    const marginBottom = parseFloat(window.getComputedStyle(element).marginBottom) || 0;
    return element.getBoundingClientRect().height + marginBottom;
  }, []);

  const estimateSize = useCallback(
    (index) => {
      const row = flattenedRows[index];
      const isTablet =
        typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024;
      const gap = getCardListItemGapPx();
      const baseHeight = isMobile ? 170 : isTablet ? 74 : 82;
      if (!row) {
        return baseHeight + gap;
      }

      const visibleFiles = getFilesVisibleForDownloadSearch(row.item, fileSearch);
      if (expandedItemsSet.has(row.item.id) && visibleFiles.length > 0) {
        const fileRowHeight = isMobile ? 56 : 48;
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

  const prevViewModeRef = useRef(viewMode);
  const prevIsFullscreenRef = useRef(isFullscreen);
  const isTransitioningRef = useRef(false);
  const [virtualRows, setVirtualRows] = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  const syncVirtualRows = useCallback(() => {
    try {
      const rows = virtualizerRef.current.getVirtualItems();
      const size = virtualizerRef.current.getTotalSize();
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
      setTotalSize((previousSize) => (previousSize === size ? previousSize : size));
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

  useLayoutEffect(() => {
    const viewModeChanged = prevViewModeRef.current !== viewMode;
    const fullscreenChanged = prevIsFullscreenRef.current !== isFullscreen;
    prevViewModeRef.current = viewMode;
    prevIsFullscreenRef.current = isFullscreen;

    if (viewModeChanged || fullscreenChanged) {
      isTransitioningRef.current = true;
      setVirtualRows([]);
      setTotalSize(0);
      isTransitioningRef.current = false;
    }
  }, [viewMode, isFullscreen]);

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

  const expandedItemsKey = useMemo(() => expandedItemsArray.join(','), [expandedItemsArray]);

  // Remeasure once scrollMargin is known (avoids overlapping cards on table→card switch)
  useLayoutEffect(() => {
    if (isFullscreen) {
      remeasureAndSync();
      return;
    }

    if (containerOffsetTop <= 0) {
      return;
    }

    remeasureAndSync();

    // Second frame: DOM + scrollMargin are settled after table→card mount
    const rafId = requestAnimationFrame(remeasureAndSync);
    return () => cancelAnimationFrame(rafId);
  }, [
    containerOffsetTop,
    expandedItemsKey,
    flattenedRows.length,
    isFullscreen,
    fullscreenScrollEl,
    remeasureAndSync,
  ]);

  return (
    <>
      <div
        ref={parentRef}
        className={`${isFullscreen ? 'p-4' : 'p-0'}`}
        style={{
          position: 'relative',
          height: `${totalSize}px`,
        }}
      >
        {/* Virtualized rows - only ItemCards */}
        {
          virtualRows
            .flatMap((virtualRow) => {
              if (virtualRow.index < 0 || virtualRow.index >= flattenedRows.length) return [];

              const row = flattenedRows[virtualRow.index];

              if (!row || !row.item) return [];

              // Position cards using the virtualizer's scrollMargin (must match container offset)
              const scrollMargin = isFullscreen ? 0 : (virtualizer.options.scrollMargin ?? 0);
              let cardTop = 0;

              if (isFullscreen) {
                cardTop = virtualRow.start;
              } else if (scrollMargin > 0) {
                cardTop = virtualRow.start - scrollMargin;
              } else {
                for (let i = 0; i < virtualRow.index; i++) {
                  cardTop += estimateSize(i);
                }
              }

              const visibleFiles = getFilesVisibleForDownloadSearch(row.item, fileSearch);
              const isExpanded = expandedItemsSet.has(row.item.id) && visibleFiles.length > 0;

              const itemCardStyle = {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${cardTop}px)`,
                willChange: 'transform',
                // Expanded cards must stack above neighbors until layout remeasures
                zIndex: isExpanded ? 20 + virtualRow.index : virtualRow.index + 1,
              };

              return (
                <div
                  key={`item-${row.item.id}`}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={itemCardStyle}
                  className={cardListItemGap}
                >
                  <ItemCard
                    item={row.item}
                    index={row.itemIndex}
                    selectedItems={selectedItems}
                    downloadHistory={downloadHistory}
                    isItemDownloaded={isItemDownloaded}
                    isFileDownloaded={isFileDownloaded}
                    isBlurred={isBlurred}
                    isDisabled={isDisabled}
                    activeColumns={activeColumns}
                    onItemSelect={handleItemSelection}
                    onFileSelect={handleFileSelection}
                    onFileDownload={handleFileDownload}
                    onFileStream={handleFileStream}
                    onAudioPlay={handleAudioPlay}
                    onDelete={onDelete}
                    toggleFiles={toggleFiles}
                    expandedItems={expandedItems} // Pass expandedItems so ItemCard can render FileList
                    fileSearch={fileSearch}
                    setItems={setItems}
                    setSelectedItems={setSelectedItems}
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
            })
            .filter(Boolean) // Remove null entries
        }
        {/* Bottom spacer for cards after last visible */}
        {virtualRows.length > 0 &&
          (() => {
            const lastVisibleRow = virtualRows[virtualRows.length - 1];
            const bottomOffset = Math.max(0, totalSize - (lastVisibleRow?.end || 0));

            // Only show bottom spacer if there are cards after the last visible one
            return bottomOffset > 0 ? <div style={{ height: bottomOffset }} /> : null;
          })()}
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

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
  hasProPlan = false,
  onOpenVideoPlayer,
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
  const scrollElementRef = useRef(null);
  const containerOffsetTopRef = useRef(0);
  const [containerOffsetTop, setContainerOffsetTop] = useState(0);

  // In fullscreen mode, use the provided scroll container ref
  // In normal mode, track container position for window scroll
  useEffect(() => {
    if (isFullscreen) {
      // Use the provided scroll container ref
      if (scrollContainerRef?.current) {
        scrollElementRef.current = scrollContainerRef.current;
      }
    } else {
      // Track the container's position in the document for window scroll
      const updateContainerOffset = () => {
        if (parentRef.current) {
          const rect = parentRef.current.getBoundingClientRect();
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const offset = rect.top + scrollTop;
          containerOffsetTopRef.current = offset;
          setContainerOffsetTop(offset);
        }
      };

      // Calculate immediately and after DOM is ready
      updateContainerOffset();
      requestAnimationFrame(updateContainerOffset);

      // Only listen to resize, not scroll, to avoid constant updates
      window.addEventListener('resize', updateContainerOffset);

      return () => {
        window.removeEventListener('resize', updateContainerOffset);
      };
    }
  }, [isFullscreen, scrollContainerRef]);

  // Defer items update to prevent synchronous updates during render
  const deferredItems = useDeferredValue(items);

  // Only virtualize ItemCards - FileList will handle its own virtualization
  const flattenedRows = useMemo(() => {
    return deferredItems.map((item, itemIndex) => ({
      item,
      itemIndex,
    }));
  }, [deferredItems]);

  // Memoize measureElement to prevent unnecessary re-renders
  const measureElement = useCallback((element) => {
    // Measure the actual rendered height of the element
    // Add margin for spacing between cards
    return element.getBoundingClientRect().height + 8;
  }, []);

  // Memoize estimateSize to prevent recalculation on every render
  const estimateSize = useCallback(() => {
    // Height estimates for mobile vs desktop
    // Mobile cards are taller due to vertical layouts
    // This will be refined by measureElement, but a good estimate helps initial render
    return isMobile ? 170 : 82;
  }, [isMobile]);

  // Use different virtualizers based on fullscreen mode
  // In fullscreen: use useVirtualizer with scroll container
  // In normal mode: use useWindowVirtualizer for window scroll
  // Disabled useFlushSync to allow React to batch updates for better performance
  const windowVirtualizer = useWindowVirtualizer({
    count: flattenedRows.length,
    estimateSize,
    measureElement,
    overscan: 30,
    scrollMargin: containerOffsetTopRef.current || containerOffsetTop,
    useFlushSync: false, // Allow React to batch updates for smoother fast scrolling
  });

  const containerVirtualizer = useVirtualizer({
    count: flattenedRows.length,
    getScrollElement: () => scrollElementRef.current,
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
    return downloadHistory.some(
      (download) =>
        String(download.itemId) === String(itemId) &&
        download.assetType === itemAssetType &&
        !download.fileId
    );
  };

  const isFileDownloaded = (itemId, fileId) => {
    const itemAssetType = itemAssetTypeMap.get(String(itemId));
    return downloadHistory.some(
      (download) =>
        String(download.itemId) === String(itemId) &&
        download.assetType === itemAssetType &&
        (!download.fileId || // Complete item downloaded (all files included)
          String(download.fileId) === String(fileId)) // Specific file downloaded
    );
  };

  // Track view mode changes to prevent flushSync errors
  const prevViewModeRef = useRef(viewMode);
  const isTransitioningRef = useRef(false);
  const [virtualRows, setVirtualRows] = useState([]);
  const [totalSize, setTotalSize] = useState(0);

  // Check for view mode change synchronously during render
  if (prevViewModeRef.current !== viewMode) {
    isTransitioningRef.current = true;
    prevViewModeRef.current = viewMode;
    // Clear virtual rows during transition
    if (virtualRows.length > 0) {
      setVirtualRows([]);
      setTotalSize(0);
    }
  }

  // Update virtual rows after render completes to prevent flushSync errors
  // This is critical when switching from Table to Card view
  useLayoutEffect(() => {
    const updateRows = () => {
      try {
        const rows = virtualizer.getVirtualItems();
        const size = virtualizer.getTotalSize();
        setVirtualRows(rows);
        setTotalSize(size);
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
  }, [virtualizer, viewMode, flattenedRows.length]);

  // Update virtual rows on scroll to keep them in sync
  // This ensures scroll updates work even though we're using state
  useEffect(() => {
    // Skip during transitions
    if (isTransitioningRef.current) return;

    const updateRows = () => {
      try {
        const rows = virtualizer.getVirtualItems();
        const size = virtualizer.getTotalSize();
        setVirtualRows(rows);
        setTotalSize(size);
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
  }, [virtualizer]);

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
            .filter((virtualRow) => {
              // Filter out invalid indices (can happen during data updates when filtering changes item count)
              return virtualRow.index >= 0 && virtualRow.index < flattenedRows.length;
            })
            .map((virtualRow) => {
              const row = flattenedRows[virtualRow.index];

              // Guard: Skip if row or row.item doesn't exist
              // This provides extra safety in case of race conditions
              if (!row || !row.item) {
                return null;
              }

              // Calculate item card position
              // In fullscreen: virtualRow.start is relative to scroll container (no conversion needed)
              // In normal mode: virtualRow.start is relative to document top, convert to container-relative
              let cardTop = 0;
              if (isFullscreen) {
                // In fullscreen, virtualRow.start is already relative to the scroll container
                cardTop = virtualRow.start;
              } else if (containerOffsetTop > 0) {
                // In normal mode, convert document-relative to container-relative
                cardTop = virtualRow.start - containerOffsetTop;
              } else {
                // Fallback: if containerOffsetTop not calculated yet, use a simple sum
                for (let i = 0; i < virtualRow.index; i++) {
                  cardTop += estimateSize();
                }
              }

              const itemCardStyle = {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${cardTop}px)`,
                marginBottom: '8px', // Add gap between cards
                willChange: 'transform',
              };

              return (
                <div
                  key={`item-${row.item.id}`}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={itemCardStyle}
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
                    onDelete={onDelete}
                    toggleFiles={toggleFiles}
                    expandedItems={expandedItems} // Pass expandedItems so ItemCard can render FileList
                    setItems={setItems}
                    setSelectedItems={setSelectedItems}
                    setToast={setToast}
                    activeType={activeType}
                    viewMode={viewMode}
                    isCopying={isCopying}
                    isDownloading={isDownloading}
                    isStreaming={isStreaming}
                    apiKey={apiKey}
                    hasProPlan={hasProPlan}
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
            const lastVisibleIndex = lastVisibleRow?.index ?? 0;

            // Calculate height of cards after the last visible card
            let bottomOffset = 0;
            if (lastVisibleIndex < flattenedRows.length - 1) {
              // Sum estimated sizes of all cards after the last visible card
              for (let i = lastVisibleIndex + 1; i < flattenedRows.length; i++) {
                bottomOffset += estimateSize();
              }
            }

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

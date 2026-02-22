'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useColumnManager } from '../shared/hooks/useColumnManager';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useDelete } from '../shared/hooks/useDelete';
import { useFetchData } from '../shared/hooks/useFetchData';
import { useFilter } from '../shared/hooks/useFilter';
import { useSelection } from '../shared/hooks/useSelection';
import { useSort } from '../shared/hooks/useSort';
import useIsMobile from '../../hooks/useIsMobile';

import AssetTypeTabs, {
  getStoredAssetType,
  ASSET_TYPE_STORAGE_KEY,
} from '@/components/shared/AssetTypeTabs';
import DownloadPanel from './DownloadPanel';
import ItemUploader from './ItemUploader';
import SpeedChart from './SpeedChart';
import Toast from '@/components/shared/Toast';
import Spinner from '../shared/Spinner';
import ItemsTable from './ItemsTable';
import ActionBar from './ActionBar/index';
import CardList from './CardList';
import VideoPlayerModal from './VideoPlayerModal';
import AudioPlayer from './AudioPlayer';
import AutomationRules from './AutomationRules';
import FiltersSection from './FiltersSection';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { useDownloadTags } from '@/components/shared/hooks/useDownloadTags';
import { useTags } from '@/components/shared/hooks/useTags';
import { useNotificationsStore } from '@/store/notificationsStore';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { migrateDownloadHistory } from '@/utils/migrateDownloadHistory';
import { formatSize } from './utils/formatters';
import { fetchUserProfile } from '@/utils/userProfile';
import { useBackendMode } from '@/hooks/useBackendMode';

export default function Downloads({ apiKey }) {
  const setPauseReason = usePollingPauseStore((state) => state.setPauseReason);
  // Subscribe to pause reasons to trigger re-render when pause state changes
  const pauseReasons = usePollingPauseStore((state) => state.pauseReasons);
  const isPollingPaused = usePollingPauseStore((state) => state.isPollingPaused);
  const [toast, setToast] = useState(null);
  const [activeType, setActiveType] = useState(getStoredAssetType);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState(false);

  // Use Zustand store for download history
  const downloadHistory = useDownloadHistoryStore((state) => state.downloadHistory);
  const fetchDownloadHistory = useDownloadHistoryStore((state) => state.fetchDownloadHistory);
  const downloadHistoryLoading = useDownloadHistoryStore((state) => state.isLoading);
  const clearDownloadHistory = useDownloadHistoryStore((state) => state.clearDownloadHistory);
  const [videoPlayerState, setVideoPlayerState] = useState({
    isOpen: false,
    streamUrl: null,
    fileName: null,
    subtitles: [],
    audios: [],
    metadata: {},
    itemId: null,
    fileId: null,
    streamType: 'torrent',
    introInformation: null,
    initialAudioIndex: 0,
    initialSubtitleIndex: null,
  });
  const [audioPlayerState, setAudioPlayerState] = useState({
    isOpen: false,
    url: null,
    itemId: null,
    fileId: null,
    assetType: 'torrent',
    fileName: null,
    apiKey: null,
  });
  const [isBlurred, setIsBlurred] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const hasExpandedRef = useRef(false);
  const scrollContainerRef = useRef(null);
  const fetchDownloadHistoryRef = useRef(false);
  const migrationAttemptedRef = useRef(false);
  const previousApiKeyRef = useRef(null);
  const isMobile = useIsMobile();
  const { mode: backendMode, isLoading: backendIsLoading } = useBackendMode();
  const isBackendAvailable = backendMode === 'backend';

  // Ensure user database exists when API key is provided
  useEffect(() => {
    if (apiKey && apiKey.length >= 20) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(apiKey)
          .then((result) => {
            if (result.success && result.wasCreated) {
              console.log('User database created for API key in Downloads component');
            }
          })
          .catch((error) => {
            console.error('Error ensuring user database:', error);
          });
      });
    }
  }, [apiKey]);

  // Fetch user profile to check for Pro plan access
  useEffect(() => {
    if (apiKey && apiKey.length >= 20) {
      fetchUserProfile(apiKey)
        .then((userData) => {
          if (userData) {
            console.log('User profile:', userData);
          } else {
            console.log('No user profile found');
          }
        })
        .catch((error) => {
          console.error('Error fetching user profile:', error);
        });
    }
  }, [apiKey]);

  // Function to expand all items with files
  const expandAllFiles = () => {
    const itemsWithFiles = itemsWithTags.filter((item) => item.files && item.files.length > 0);
    const itemIds = itemsWithFiles.map((item) => item.id);
    setExpandedItems(new Set(itemIds));
  };

  // Function to collapse all files
  const collapseAllFiles = () => {
    setExpandedItems(new Set());
  };

  const { loading, items, setItems, fetchItems } = useFetchData(apiKey, activeType);

  // Load tags (only if backend is available)
  const { loadTags, tags, loading: tagsLoading } = useTags(apiKey);

  // Load tags once when component mounts (only if backend is available)
  useEffect(() => {
    if (isBackendAvailable && apiKey && tags.length === 0 && !tagsLoading) {
      loadTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, isBackendAvailable]);

  // Load download tags (only if backend is available)
  const {
    fetchDownloadTags,
    mapTagsToDownloads,
    tagMappings,
    loading: downloadTagsLoading,
  } = useDownloadTags(apiKey);

  // Load download tags once when component mounts (only if backend is available)
  useEffect(() => {
    if (
      isBackendAvailable &&
      apiKey &&
      Object.keys(tagMappings).length === 0 &&
      !downloadTagsLoading
    ) {
      fetchDownloadTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, isBackendAvailable]);

  // Map tags to items whenever items or tagMappings change
  const itemsWithTags = useMemo(() => {
    if (!items || items.length === 0) return items;
    return mapTagsToDownloads(items);
  }, [items, tagMappings, mapTagsToDownloads]);

  const {
    selectedItems,
    handleSelectAll,
    handleFileSelect,
    hasSelectedFiles,
    handleRowSelect,
    setSelectedItems,
  } = useSelection(itemsWithTags);
  const {
    downloadLinks,
    isDownloading,
    downloadProgress,
    handleBulkDownload,
    setDownloadLinks,
    requestDownloadLink,
  } = useDownloads(apiKey, activeType, downloadHistory, fetchDownloadHistory);

  const { isDeleting, deleteItem, deleteItems } = useDelete(
    apiKey,
    setItems,
    setSelectedItems,
    setToast,
    fetchItems,
    activeType
  );

  const { activeColumns, handleColumnChange } = useColumnManager(activeType);
  const { sortField, sortDirection, handleSort, setSort, sortTorrents } = useSort();

  const [columnFilters, setColumnFilters] = useState({
    logicOperator: 'and',
    groups: [
      {
        logicOperator: 'and',
        filters: [],
      },
    ],
  });
  const [appliedFilters, setAppliedFilters] = useState({
    logicOperator: 'and',
    groups: [
      {
        logicOperator: 'and',
        filters: [],
      },
    ],
  });
  const { search, setSearch, statusFilter, setStatusFilter, filteredItems } = useFilter(
    itemsWithTags,
    '',
    'all',
    appliedFilters
  );

  // Load custom views (only if backend is available)
  const {
    views,
    activeView,
    applyView,
    clearView,
    loadViews,
    loading: viewsLoading,
  } = useCustomViews(apiKey);

  // Load custom views once when component mounts (only if backend is available)
  useEffect(() => {
    if (isBackendAvailable && apiKey && views.length === 0 && !viewsLoading) {
      loadViews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, isBackendAvailable]);

  // Update pause reason when video player opens/closes
  useEffect(() => {
    setPauseReason('videoPlayer', videoPlayerState.isOpen);
  }, [videoPlayerState.isOpen, setPauseReason]);

  // Update pause reason when audio player opens/closes
  useEffect(() => {
    setPauseReason('audioPlayer', audioPlayerState.isOpen);
  }, [audioPlayerState.isOpen, setPauseReason]);

  // Start notifications polling once when component mounts
  const { fetchNotifications: fetchNotificationsStore } = useNotificationsStore();
  useEffect(() => {
    if (apiKey) {
      // Perform initial fetch
      fetchNotificationsStore(apiKey);

      // Set up periodic polling (every 2 minutes)
      const interval = setInterval(() => {
        // Check if polling is paused (e.g., video or audio player is open)
        if (isPollingPaused()) {
          return;
        }
        // Read isPolling from store inside callback to get current value
        const { isPolling } = useNotificationsStore.getState();
        if (isPolling) {
          fetchNotificationsStore(apiKey);
        }
      }, 120000); // 2 minutes

      return () => {
        clearInterval(interval);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, pauseReasons]);

  const sortedItems = sortTorrents(filteredItems);

  const onFullscreenToggle = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Bulk export torrent files
  const handleBulkExport = async () => {
    if (isExporting || activeType !== 'torrents') return;
    setIsExporting(true);

    try {
      const selectedItemIds = Array.from(selectedItems.items);
      if (selectedItemIds.length === 0) {
        setToast({
          message: 'No items selected for export',
          type: 'error',
        });
        return;
      }

      // Export each selected torrent
      for (const itemId of selectedItemIds) {
        const item = itemsWithTags.find((i) => i.id === itemId);
        if (!item) continue;

        try {
          const response = await fetch(`/api/torrents/export?torrent_id=${itemId}&type=torrent`, {
            headers: {
              'x-api-key': apiKey,
            },
          });

          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${item.name || item.id}.torrent`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          } else {
            console.error(`Failed to export torrent ${itemId}`);
          }
        } catch (error) {
          console.error(`Error exporting torrent ${itemId}:`, error);
        }
      }

      setToast({
        message: `Exported ${selectedItemIds.length} torrent files`,
        type: 'success',
      });
    } catch (error) {
      console.error('Error during bulk export:', error);
      setToast({
        message: 'Failed to export torrent files',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleAudioPlay = useCallback(
    async (itemId, file) => {
      const idField =
        activeType === 'usenet' ? 'usenet_id' : activeType === 'webdl' ? 'web_id' : 'torrent_id';
      const metadata = {
        assetType: activeType,
        item: itemsWithTags.find((i) => i.id === itemId),
      };
      const result = await requestDownloadLink(
        itemId,
        { fileId: file.id, filename: file.name || file.short_name },
        idField,
        metadata
      );
      if (result.success && result.data?.url) {
        setAudioPlayerState({
          isOpen: true,
          url: result.data.url,
          itemId,
          fileId: file.id,
          assetType: activeType,
          fileName: file.name || file.short_name || 'Audio',
          apiKey,
        });
      } else {
        setToast({
          message: result.error || 'Could not get audio link',
          type: 'error',
        });
      }
    },
    [activeType, itemsWithTags, requestDownloadLink, setToast, apiKey]
  );

  const handleAudioRefreshUrl = useCallback(async () => {
    const { itemId, fileId, assetType: at, apiKey: key } = audioPlayerState;
    if (itemId == null || fileId == null || !key) return null;
    const idField = at === 'usenet' ? 'usenet_id' : at === 'webdl' ? 'web_id' : 'torrent_id';
    const metadata = {
      assetType: at,
      item: itemsWithTags.find((i) => i.id === itemId),
    };
    const result = await requestDownloadLink(itemId, { fileId }, idField, metadata);
    if (result.success && result.data?.url) {
      setAudioPlayerState((prev) => ({ ...prev, url: result.data.url }));
      return result.data.url;
    }
    throw new Error(result.error || 'Failed to refresh link');
  }, [audioPlayerState, itemsWithTags, requestDownloadLink]);

  const toggleFiles = (itemId) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    const storedViewMode = localStorage.getItem('downloads-view-mode');
    if (storedViewMode) {
      // If mobile, always set to table view
      setViewMode(isMobile ? 'table' : storedViewMode);
    }
  }, []);

  // One-time migration from localStorage to backend, then fetch from backend
  useEffect(() => {
    // Wait for backend check to complete before deciding
    if (backendIsLoading) {
      return;
    }

    // Check if API key has changed (even from one valid key to another)
    const apiKeyChanged =
      previousApiKeyRef.current !== null && previousApiKeyRef.current !== apiKey;

    if (!apiKey) {
      fetchDownloadHistoryRef.current = false;
      migrationAttemptedRef.current = false;
      previousApiKeyRef.current = null;
      clearDownloadHistory();
      return;
    }

    // If API key changed, reset refs and clear old download history
    if (apiKeyChanged) {
      fetchDownloadHistoryRef.current = false;
      migrationAttemptedRef.current = false;
      clearDownloadHistory();
    }

    // Update previous API key ref
    previousApiKeyRef.current = apiKey;

    // Only fetch if backend is available
    if (!isBackendAvailable) {
      return;
    }

    // Only run migration once per API key
    if (migrationAttemptedRef.current) {
      // Migration already attempted, just fetch if needed
      if (
        downloadHistory.length === 0 &&
        !downloadHistoryLoading &&
        !fetchDownloadHistoryRef.current
      ) {
        fetchDownloadHistoryRef.current = true;
        fetchDownloadHistory(apiKey);
      }
      return;
    }

    const runMigrationAndFetch = async () => {
      migrationAttemptedRef.current = true;

      // Run migration first (it will skip if already done)
      const migrationResult = await migrateDownloadHistory(apiKey);
      if (migrationResult.success && migrationResult.migrated > 0) {
        console.log(`Migrated ${migrationResult.migrated} entries from localStorage`);
      }

      // Then fetch from backend (will include migrated entries)
      if (
        downloadHistory.length === 0 &&
        !downloadHistoryLoading &&
        !fetchDownloadHistoryRef.current
      ) {
        fetchDownloadHistoryRef.current = true;
        fetchDownloadHistory(apiKey);
      }
    };

    runMigrationAndFetch();
  }, [
    apiKey,
    downloadHistory.length,
    downloadHistoryLoading,
    fetchDownloadHistory,
    clearDownloadHistory,
    isBackendAvailable,
    backendIsLoading,
  ]);

  // Expand rows with selected files on initial load
  useEffect(() => {
    if (!items?.length || !selectedItems?.files?.size) return;
    if (hasExpandedRef.current) return;

    // Expand all items that have selected files
    selectedItems.files.forEach((_, itemId) => {
      setExpandedItems((prev) => new Set([...prev, itemId]));
    });

    hasExpandedRef.current = true;
  }, [items, selectedItems.files]);

  // Get the total size of all selected items and files
  const getTotalDownloadSize = useCallback(() => {
    // Calculate size of selected files
    const filesSize = Array.from(selectedItems.files.entries()).reduce((acc, [itemId, fileIds]) => {
      const item = itemsWithTags.find((i) => i.id === itemId);
      if (!item) return acc;

      return (
        acc +
        Array.from(fileIds).reduce((sum, fileId) => {
          const file = item.files.find((f) => f.id === fileId);
          return sum + (file?.size || 0);
        }, 0)
      );
    }, 0);

    // Calculate size of selected items
    const itemsSize = Array.from(selectedItems.items).reduce((acc, itemId) => {
      const item = itemsWithTags.find((i) => i.id === itemId);
      return acc + (item?.size || 0);
    }, 0);

    return formatSize(filesSize + itemsSize);
  }, [itemsWithTags, selectedItems]);

  // Render uploaders based on active type
  const renderUploaders = () => {
    if (activeType === 'all') {
      return (
        <div className="space-y-2">
          <ItemUploader apiKey={apiKey} activeType="torrents" />
          <ItemUploader apiKey={apiKey} activeType="usenet" />
          <ItemUploader apiKey={apiKey} activeType="webdl" />
        </div>
      );
    }
    return <ItemUploader apiKey={apiKey} activeType={activeType} />;
  };

  // Handle view application with proper filter normalization
  const handleApplyView = (view) => {
    applyView(view);

    // Reset status filter to 'all' when applying a view
    setStatusFilter('all');

    // Parse filters if they're stored as JSON string (defensive)
    let filters = view.filters;
    if (typeof filters === 'string') {
      try {
        filters = JSON.parse(filters);
      } catch (e) {
        console.error('Error parsing view filters:', e);
        filters = null;
      }
    }

    // Normalize filters structure
    let normalizedFilters = {
      logicOperator: 'and',
      groups: [
        {
          logicOperator: 'and',
          filters: [],
        },
      ],
    };

    if (filters) {
      if (filters.groups && Array.isArray(filters.groups)) {
        // New group structure - deep copy to ensure React detects change
        normalizedFilters = JSON.parse(JSON.stringify(filters));
      } else if (Array.isArray(filters)) {
        // Old flat structure - convert to groups
        normalizedFilters = {
          logicOperator: 'and',
          groups: [
            {
              logicOperator: 'and',
              filters: filters,
            },
          ],
        };
      }
    }

    // Apply filters - set both draft and applied
    setColumnFilters(normalizedFilters);
    setAppliedFilters(normalizedFilters);

    // Apply sort if specified
    if (view.sort_field) {
      setSort(view.sort_field, view.sort_direction || 'desc');
    }

    // Apply visible columns if specified
    let visibleColumns = view.visible_columns;
    if (visibleColumns) {
      // Parse visible_columns if it's a JSON string (defensive)
      if (typeof visibleColumns === 'string') {
        try {
          visibleColumns = JSON.parse(visibleColumns);
        } catch (e) {
          console.error('Error parsing visible columns:', e);
          visibleColumns = null;
        }
      }
      if (Array.isArray(visibleColumns) && visibleColumns.length > 0) {
        handleColumnChange(visibleColumns);
      }
    }
  };

  // Handle clearing view
  const handleClearView = () => {
    clearView();
    const emptyFilters = {
      logicOperator: 'and',
      groups: [
        {
          logicOperator: 'and',
          filters: [],
        },
      ],
    };
    setColumnFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  return (
    <div className="space-y-3">
      {/* Asset Type Tabs */}
      <AssetTypeTabs
        activeType={activeType}
        onTypeChange={(type) => {
          setActiveType(type);
          localStorage.setItem(ASSET_TYPE_STORAGE_KEY, type);
          setSelectedItems({ items: new Set(), files: new Map() });
        }}
      />

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner size="sm" className="text-primary-text dark:text-primary-text-dark" />
        </div>
      ) : (
        <>
          {/* Upload & Automation Section - Compact Grouping */}
          <div className="space-y-2">
            {renderUploaders()}
            {(activeType === 'torrents' || activeType === 'all') && <AutomationRules />}
          </div>

          {/* Speed Chart - Collapsible by default */}
          <SpeedChart items={items} />

          {/* Download Panel */}
          <DownloadPanel
            downloadLinks={downloadLinks}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            onDismiss={() => setDownloadLinks([])}
            isDownloadPanelOpen={isDownloadPanelOpen}
            setIsDownloadPanelOpen={setIsDownloadPanelOpen}
            setToast={setToast}
          />

          {/* Filters Section */}
          <FiltersSection
            apiKey={apiKey}
            activeType={activeType}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            activeView={isBackendAvailable ? activeView : null}
            views={isBackendAvailable ? views : null}
            sortField={sortField}
            sortDirection={sortDirection}
            activeColumns={activeColumns}
            onApplyView={handleApplyView}
            onClearView={handleClearView}
            onFiltersChange={(filters) => {
              // Apply the filters to the table
              setAppliedFilters(filters);
            }}
          />

          {/* Divider */}
          <div className="h-px w-full border-t border-border dark:border-border-dark"></div>

          <div
            ref={scrollContainerRef}
            className={`${isFullscreen ? 'fixed inset-0 z-20 bg-surface dark:bg-surface-dark overflow-auto' : 'relative z-[1]'} ${
              downloadLinks.length > 0 ? 'mb-12' : ''
            }`}
          >
            {/* ActionBar - becomes fixed when scrolled past */}
            <ActionBar
              unfilteredItems={itemsWithTags}
              filteredItems={filteredItems}
              selectedItems={selectedItems}
              setSelectedItems={setSelectedItems}
              hasSelectedFiles={hasSelectedFiles}
              activeColumns={activeColumns}
              onColumnChange={handleColumnChange}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              isDownloading={isDownloading}
              onBulkDownload={() => handleBulkDownload(selectedItems, sortedItems)}
              isDeleting={isDeleting}
              onBulkDelete={(includeParentDownloads) =>
                deleteItems(selectedItems, includeParentDownloads, itemsWithTags)
              }
              isExporting={isExporting}
              onBulkExport={handleBulkExport}
              activeType={activeType}
              isBlurred={isBlurred}
              onBlurToggle={() => setIsBlurred(!isBlurred)}
              isFullscreen={isFullscreen}
              onFullscreenToggle={onFullscreenToggle}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortField={sortField}
              sortDir={sortDirection}
              handleSort={handleSort}
              getTotalDownloadSize={getTotalDownloadSize}
              isDownloadPanelOpen={isDownloadPanelOpen}
              setIsDownloadPanelOpen={setIsDownloadPanelOpen}
              apiKey={apiKey}
              setToast={setToast}
              expandAllFiles={expandAllFiles}
              collapseAllFiles={collapseAllFiles}
              expandedItems={expandedItems}
              scrollContainerRef={scrollContainerRef}
            />

            {viewMode === 'table' ? (
              <ItemsTable
                apiKey={apiKey}
                activeType={activeType}
                activeColumns={activeColumns}
                setItems={setItems}
                selectedItems={selectedItems}
                handleSelectAll={handleSelectAll}
                handleFileSelect={handleFileSelect}
                handleRowSelect={handleRowSelect}
                setSelectedItems={setSelectedItems}
                downloadHistory={downloadHistory}
                isBlurred={isBlurred}
                deleteItem={deleteItem}
                sortedItems={sortedItems}
                sortField={sortField}
                sortDirection={sortDirection}
                handleSort={handleSort}
                setToast={setToast}
                expandedItems={expandedItems}
                toggleFiles={toggleFiles}
                isFullscreen={isFullscreen}
                scrollContainerRef={scrollContainerRef}
                onOpenVideoPlayer={(
                  streamUrl,
                  fileName,
                  subtitles,
                  audios,
                  metadata,
                  itemId,
                  fileId,
                  streamType,
                  introInformation,
                  initialAudioIndex,
                  initialSubtitleIndex
                ) => {
                  setVideoPlayerState({
                    isOpen: true,
                    streamUrl,
                    fileName,
                    subtitles,
                    audios,
                    metadata: metadata || {},
                    itemId,
                    fileId,
                    streamType,
                    introInformation: introInformation || null,
                    initialAudioIndex: initialAudioIndex !== undefined ? initialAudioIndex : 0,
                    initialSubtitleIndex:
                      initialSubtitleIndex !== undefined ? initialSubtitleIndex : null,
                  });
                }}
                onAudioPlay={handleAudioPlay}
              />
            ) : (
              <CardList
                items={sortedItems}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                setItems={setItems}
                apiKey={apiKey}
                activeColumns={activeColumns}
                onFileSelect={handleFileSelect}
                downloadHistory={downloadHistory}
                onDelete={deleteItem}
                expandedItems={expandedItems}
                toggleFiles={toggleFiles}
                setToast={setToast}
                activeType={activeType}
                isBlurred={isBlurred}
                isFullscreen={isFullscreen}
                viewMode={viewMode}
                scrollContainerRef={scrollContainerRef}
                onOpenVideoPlayer={(
                  streamUrl,
                  fileName,
                  subtitles,
                  audios,
                  metadata,
                  itemId,
                  fileId,
                  streamType,
                  introInformation,
                  initialAudioIndex,
                  initialSubtitleIndex
                ) => {
                  setVideoPlayerState({
                    isOpen: true,
                    streamUrl,
                    fileName,
                    subtitles,
                    audios,
                    metadata: metadata || {},
                    itemId,
                    fileId,
                    streamType,
                    introInformation: introInformation || null,
                    initialAudioIndex: initialAudioIndex !== undefined ? initialAudioIndex : 0,
                    initialSubtitleIndex:
                      initialSubtitleIndex !== undefined ? initialSubtitleIndex : null,
                  });
                }}
                onAudioPlay={handleAudioPlay}
              />
            )}
          </div>
          <VideoPlayerModal
            isOpen={videoPlayerState.isOpen}
            onClose={() =>
              setVideoPlayerState({
                isOpen: false,
                streamUrl: null,
                fileName: null,
                subtitles: [],
                audios: [],
                metadata: {},
                itemId: null,
                fileId: null,
                streamType: 'torrent',
                introInformation: null,
                initialAudioIndex: 0,
                initialSubtitleIndex: null,
              })
            }
            streamUrl={videoPlayerState.streamUrl}
            fileName={videoPlayerState.fileName}
            subtitles={videoPlayerState.subtitles}
            audios={videoPlayerState.audios}
            metadata={videoPlayerState.metadata}
            apiKey={apiKey}
            itemId={videoPlayerState.itemId}
            fileId={videoPlayerState.fileId}
            streamType={videoPlayerState.streamType}
            introInformation={videoPlayerState.introInformation}
            initialAudioIndex={videoPlayerState.initialAudioIndex}
            initialSubtitleIndex={videoPlayerState.initialSubtitleIndex}
            onStreamUrlChange={(newUrl) =>
              setVideoPlayerState((prev) => ({ ...prev, streamUrl: newUrl }))
            }
          />
          {audioPlayerState.isOpen && (
            <AudioPlayer
              audioUrl={audioPlayerState.url}
              fileName={audioPlayerState.fileName}
              itemId={audioPlayerState.itemId}
              fileId={audioPlayerState.fileId}
              assetType={audioPlayerState.assetType}
              apiKey={audioPlayerState.apiKey}
              onClose={() =>
                setAudioPlayerState({
                  isOpen: false,
                  url: null,
                  itemId: null,
                  fileId: null,
                  assetType: 'torrent',
                  fileName: null,
                  apiKey: null,
                })
              }
              onRefreshUrl={handleAudioRefreshUrl}
            />
          )}
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

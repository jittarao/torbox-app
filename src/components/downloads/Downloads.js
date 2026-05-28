'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
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
import FiltersSidebar, { filtersFromView } from './FiltersSidebar';
import useFiltersSidebarCollapsed from './FiltersSidebar/useFiltersSidebarCollapsed';
import MobileFiltersDrawer from './FiltersSidebar/MobileFiltersDrawer';
import FilterEditorModal from './FilterEditorModal';
import TagManager from './Tags/TagManager';
import ActiveFiltersBar from './ActiveFiltersBar';
import { itemHasFileNameSearchMatch } from './utils/downloadSearch';
import {
  EMPTY_FILTERS,
  buildTagFilter,
  normalizeFilters,
  mergeViewAssetTypeFilter,
  getActiveTagIds,
} from './filters/filterHelpers';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { useDownloadTags } from '@/components/shared/hooks/useDownloadTags';
import { useTags } from '@/components/shared/hooks/useTags';
import { useNotificationsStore } from '@/store/notificationsStore';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { migrateDownloadHistory } from '@/utils/migrateDownloadHistory';
import { formatSize } from './utils/formatters';
import {
  enrichDownloadsWithTbm,
  buildDownloadHistoryLookup,
} from './utils/tbmDownloadEnrichment';
import { findItemBySelectionId } from '@/utils/downloadSelectionId';
import { fetchUserProfile, getUserPermissions, hasDownloadAccess } from '@/utils/userProfile';
import { useBackendMode } from '@/hooks/useBackendMode';
import ReferralCallout from '@/components/referral/ReferralCallout';
import UsageCallout from '@/components/downloads/UsageCallout';
import ApiKeyInput from '@/components/downloads/ApiKeyInput';
import FetchStatusBanner from '@/components/downloads/FetchStatusBanner';
import AutoRefreshIndicator from '@/components/downloads/AutoRefreshIndicator';
import { useTranslations } from 'next-intl';

const FILTERS_SIDEBAR_EXPANDED = '14rem';
const FILTERS_SIDEBAR_COLLAPSED = '2.5rem';

function Uploaders({ apiKey, activeType, permissions }) {
  if (activeType === 'all') {
    return (
      <div className="space-y-2">
        <ItemUploader apiKey={apiKey} activeType="torrents" />
        {hasDownloadAccess('usenet', permissions) && (
          <ItemUploader apiKey={apiKey} activeType="usenet" />
        )}
        <ItemUploader apiKey={apiKey} activeType="webdl" />
      </div>
    );
  }
  return <ItemUploader key={activeType} apiKey={apiKey} activeType={activeType} />;
}

export default function Downloads({ apiKey, onApiKeyChange }) {
  const downloadsFiltersT = useTranslations('DownloadsFilters');
  const downloadPanelT = useTranslations('DownloadPanel');
  const fetchStatusT = useTranslations('FetchStatus');
  const setPauseReason = usePollingPauseStore((state) => state.setPauseReason);
  const isPollingPaused = usePollingPauseStore((state) => state.isPollingPaused);
  const pollingPaused = usePollingPauseStore((state) =>
    Object.values(state.pauseReasons).some((isPaused) => isPaused === true)
  );
  const [toast, setToast] = useState(null);
  const [activeType, setActiveType] = useState(getStoredAssetType);
  const [permissions, setPermissions] = useState(null);
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
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('downloads-view-mode') || 'table'
  );
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const hasExpandedRef = useRef(false);
  /** Item ids auto-expanded for file-name search; collapsed when search is cleared. */
  const searchExpandedItemIdsRef = useRef(new Set());
  const scrollContainerRef = useRef(null);
  const fetchDownloadHistoryRef = useRef(false);
  const migrationAttemptedRef = useRef(false);
  const previousApiKeyRef = useRef(null);
  const isMobile = useIsMobile();
  /** Mobile always uses card layout; desktop preference is preserved in viewMode. */
  const displayViewMode = isMobile ? 'card' : viewMode;
  const { collapsed: filtersSidebarCollapsed, toggleCollapsed: toggleFiltersSidebar } =
    useFiltersSidebarCollapsed();
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

  // Fetch user profile and derive permissions (plan-based feature access)
  useEffect(() => {
    if (apiKey && apiKey.length >= 20) {
      fetchUserProfile(apiKey)
        .then((userData) => {
          if (userData) {
            setPermissions(getUserPermissions(userData));
          } else {
            setPermissions(null);
          }
        })
        .catch((error) => {
          console.error('Error fetching user profile:', error);
          setPermissions(null);
        });
    } else {
      setPermissions(null);
    }
  }, [apiKey]);

  const canUseUsenet = hasDownloadAccess('usenet', permissions);

  // Function to collapse all files
  const collapseAllFiles = () => {
    searchExpandedItemIdsRef.current = new Set();
    setExpandedItems(new Set());
  };

  const {
    loading,
    error: fetchError,
    items,
    setItems,
    fetchItems,
    dismissError,
    lastSuccessfulFetchAt,
    refreshBlockedReason,
    pollSchedule,
    canManualRefresh,
  } = useFetchData(apiKey, activeType);

  const showFullPageSpinner = loading && items.length === 0;
  const isRefreshing = loading && items.length > 0;

  // Load tags (only if backend is available)
  const { loadTags, tags, loading: tagsLoading, updateTag: updateTagName } = useTags(apiKey);

  // Load tags once when component mounts (only if backend is available)
  useEffect(() => {
    if (isBackendAvailable && apiKey && tags.length === 0 && !tagsLoading) {
      loadTags();
    }
    // tags.length, tagsLoading, loadTags intentionally omitted to prevent
    // infinite loop when tags are loaded — should only run on mount/key change.
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
    // tagMappings.length, downloadTagsLoading, fetchDownloadTags intentionally
    // omitted to prevent infinite loop — should only run on mount/key change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, isBackendAvailable]);

  const downloadHistoryLookup = useMemo(
    () => buildDownloadHistoryLookup(downloadHistory),
    [downloadHistory]
  );

  /** TorBox API downloads merged with TBM backend data (tags, link-history flags). */
  const enrichedDownloads = useMemo(
    () => enrichDownloadsWithTbm(items, mapTagsToDownloads, downloadHistoryLookup),
    [items, tagMappings, mapTagsToDownloads, downloadHistoryLookup]
  );

  const expandAllFiles = () => {
    searchExpandedItemIdsRef.current = new Set();
    const itemsWithFiles = enrichedDownloads.filter((item) => item.files && item.files.length > 0);
    const itemIds = itemsWithFiles.map((item) => item.id);
    setExpandedItems(new Set(itemIds));
  };

  const {
    selectedItems,
    handleSelectAll,
    handleFileSelect,
    hasSelectedFiles,
    handleRowSelect,
    setSelectedItems,
  } = useSelection(enrichedDownloads);

  // If usenet is selected but user doesn't have Pro plan, switch to all
  useEffect(() => {
    if (!canUseUsenet && activeType === 'usenet') {
      setActiveType('all');
      localStorage.setItem(ASSET_TYPE_STORAGE_KEY, 'all');
      setSelectedItems({ items: new Set(), files: new Map() });
    }
  }, [canUseUsenet, activeType, setActiveType, setSelectedItems]);

  const handleBulkDownloadComplete = useCallback(
    ({ succeeded, failed, total }) => {
      if (failed === 0) return;
      setToast({
        message:
          succeeded > 0
            ? downloadPanelT('toast.bulkPartialFailure', { failed, total })
            : downloadPanelT('toast.bulkAllFailed', { total }),
        type: 'error',
      });
    },
    [downloadPanelT]
  );

  const {
    downloadLinks,
    isDownloading,
    downloadProgress,
    handleBulkDownload,
    setDownloadLinks,
    requestDownloadLink,
  } = useDownloads(
    apiKey,
    activeType,
    downloadHistory,
    fetchDownloadHistory,
    handleBulkDownloadComplete
  );

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

  const [columnFilters, setColumnFilters] = useState(() =>
    JSON.parse(JSON.stringify(EMPTY_FILTERS))
  );
  const [appliedFilters, setAppliedFilters] = useState(() =>
    JSON.parse(JSON.stringify(EMPTY_FILTERS))
  );
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  /** @type {[null | 'create' | 'edit' | 'filter', Function]} */
  const [filterModalMode, setFilterModalMode] = useState(null);
  const [editingView, setEditingView] = useState(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [tagManagerAutoCreate, setTagManagerAutoCreate] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { search, setSearch, statusFilter, setStatusFilter, filteredItems } = useFilter(
    enrichedDownloads,
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
    updateView,
    loading: viewsLoading,
  } = useCustomViews(apiKey);

  const activeTagIds = useMemo(() => getActiveTagIds(appliedFilters), [appliedFilters]);

  // Load custom views once when component mounts (only if backend is available)
  useEffect(() => {
    if (isBackendAvailable && apiKey && views.length === 0 && !viewsLoading) {
      loadViews();
    }
    // views.length, viewsLoading, loadViews intentionally omitted to prevent
    // infinite loop — should only run on mount/key change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, isBackendAvailable]);

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
    // Only re-run when apiKey changes; pause state is read inside the interval callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const sortedItems = sortTorrents(filteredItems);

  // Expand items that contain matching files so file rows are visible; undo on clear
  useEffect(() => {
    const query = search.trim();
    if (!query) {
      const searchExpanded = searchExpandedItemIdsRef.current;
      if (searchExpanded.size === 0) return;

      setExpandedItems((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const id of searchExpanded) {
          if (selectedItems.files.has(id)) continue;
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
      searchExpandedItemIdsRef.current = new Set();
      return;
    }

    setExpandedItems((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const item of filteredItems) {
        if (
          itemHasFileNameSearchMatch(item, query) &&
          item.files?.length > 0 &&
          !next.has(item.id)
        ) {
          next.add(item.id);
          searchExpandedItemIdsRef.current.add(item.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [search, filteredItems, selectedItems.files]);

  const onFullscreenToggle = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Reset scroll when entering fullscreen so virtualization starts from the top
  useLayoutEffect(() => {
    if (isFullscreen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isFullscreen]);

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

      await Promise.all(
        selectedItemIds.map(async (itemId) => {
          const item = enrichedDownloads.find((i) => i.id === itemId);
          if (!item) return;

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
        })
      );

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
        item: enrichedDownloads.find((i) => i.id === itemId),
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
        setPauseReason('audioPlayer', true);
      } else {
        setToast({
          message: result.error || 'Could not get audio link',
          type: 'error',
        });
      }
    },
    [activeType, enrichedDownloads, requestDownloadLink, setToast, apiKey, setPauseReason]
  );

  const handleAudioRefreshUrl = useCallback(async () => {
    const { itemId, fileId, assetType: at, apiKey: key } = audioPlayerState;
    if (itemId == null || fileId == null || !key) {
      throw new Error('Cannot refresh link: missing item, file, or API key');
    }
    const idField = at === 'usenet' ? 'usenet_id' : at === 'webdl' ? 'web_id' : 'torrent_id';
    const metadata = {
      assetType: at,
      item: enrichedDownloads.find((i) => i.id === itemId),
    };
    const result = await requestDownloadLink(itemId, { fileId }, idField, metadata);
    if (result.success && result.data?.url) {
      setAudioPlayerState((prev) => ({ ...prev, url: result.data.url }));
      return result.data.url;
    }
    throw new Error(result.error || 'Failed to refresh link');
  }, [audioPlayerState, enrichedDownloads, requestDownloadLink]);

  const toggleFiles = (itemId) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      searchExpandedItemIdsRef.current.delete(itemId);
      return newSet;
    });
  };

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
    selectedItems.files.forEach((_, selectionId) => {
      const item = findItemBySelectionId(items, selectionId);
      if (item?.id != null) {
        setExpandedItems((prev) => new Set([...prev, item.id]));
      }
    });

    hasExpandedRef.current = true;
  }, [items, selectedItems.files]);

  // Get the total size of all selected items and files
  const getTotalDownloadSize = useCallback(() => {
    // Calculate size of selected files
    const filesSize = Array.from(selectedItems.files.entries()).reduce((acc, [selectionId, fileIds]) => {
      const item = findItemBySelectionId(enrichedDownloads, selectionId);
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
    const itemsSize = Array.from(selectedItems.items).reduce((acc, selectionId) => {
      const item = findItemBySelectionId(enrichedDownloads, selectionId);
      return acc + (item?.size || 0);
    }, 0);

    return formatSize(filesSize + itemsSize);
  }, [enrichedDownloads, selectedItems]);

  const handleApplyView = (view) => {
    applyView(view);
    setStatusFilter('all');

    const normalizedFilters = mergeViewAssetTypeFilter(view.filters, view.asset_type);
    setColumnFilters(normalizedFilters);
    setAppliedFilters(normalizedFilters);

    if (view.sort_field) {
      setSort(view.sort_field, view.sort_direction || 'desc');
    }

    let visibleColumns = view.visible_columns;
    if (visibleColumns) {
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

    setSearch(view.search_query || '');

    setMobileFiltersOpen(false);
  };

  const handleClearFilters = () => {
    clearView();
    const empty = JSON.parse(JSON.stringify(EMPTY_FILTERS));
    setColumnFilters(empty);
    setAppliedFilters(empty);
    setSearch('');
  };

  const handleClearView = handleClearFilters;

  const handleApplyTag = (tagId) => {
    const id = Number(tagId);
    const isActive = activeTagIds?.length === 1 && activeTagIds[0] === id && !activeView;

    if (isActive) {
      handleClearFilters();
      return;
    }

    clearView();
    setStatusFilter('all');
    setSearch('');
    const tagFilter = buildTagFilter(id);
    setColumnFilters(tagFilter);
    setAppliedFilters(tagFilter);
    setMobileFiltersOpen(false);
  };

  const handleCloseFilterModal = useCallback(() => {
    setFilterModalOpen(false);
    setFilterModalMode(null);
    setEditingView(null);
  }, []);

  const handleEditView = (view) => {
    setEditingView(view);
    setColumnFilters(filtersFromView(view));
    setFilterModalMode('edit');
    setFilterModalOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleViewCreated = (view) => {
    handleApplyView(view);
    setToast({
      message: downloadsFiltersT('viewCreated', { name: view.name }),
      type: 'success',
    });
  };

  const handleViewUpdated = (view) => {
    if (activeView?.id === view.id) {
      handleApplyView(view);
    }
    setToast({
      message: downloadsFiltersT('viewUpdated', { name: view.name }),
      type: 'success',
    });
  };

  const handleRenameView = async (view) => {
    const newName = window.prompt('Rename view:', view.name);
    if (!newName?.trim() || newName.trim() === view.name) return;
    try {
      await updateView(view.id, { name: newName.trim() });
    } catch (error) {
      alert(`Failed to rename view: ${error.message}`);
    }
  };

  const handleRenameTag = async (tag) => {
    const newName = window.prompt('Rename tag:', tag.name);
    if (!newName?.trim() || newName.trim() === tag.name) return;
    try {
      await updateTagName(tag.id, newName.trim());
    } catch (error) {
      alert(`Failed to rename tag: ${error.message}`);
    }
  };

  const handleTagDeleted = (tagId) => {
    if (activeTagIds?.includes(Number(tagId))) {
      handleClearFilters();
    }
  };

  const handleOpenNewFilter = () => {
    setEditingView(null);
    setColumnFilters(normalizeFilters(appliedFilters));
    setFilterModalMode('filter');
    setFilterModalOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleOpenNewView = () => {
    clearView();
    setEditingView(null);
    setColumnFilters(JSON.parse(JSON.stringify(EMPTY_FILTERS)));
    setFilterModalMode('create');
    setFilterModalOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleOpenTagManager = (autoCreate = false) => {
    setTagManagerAutoCreate(autoCreate);
    setTagManagerOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleNewTag = () => handleOpenTagManager(true);

  const handleManageTags = () => handleOpenTagManager(false);

  const showDesktopFiltersSidebar = isBackendAvailable && !isMobile && !isFullscreen;
  const filtersSidebarExpanded = showDesktopFiltersSidebar && !filtersSidebarCollapsed;
  const filtersSidebarWidth = filtersSidebarCollapsed
    ? FILTERS_SIDEBAR_COLLAPSED
    : FILTERS_SIDEBAR_EXPANDED;

  const handleApplyFiltersFromModal = (filters) => {
    setAppliedFilters(normalizeFilters(filters));
  };

  const handlePreviewFiltersFromModal = useCallback(
    (filters, { includeSort = false, includeSearch = false } = {}) => {
      const assetType =
        filterModalMode === 'edit' && editingView?.asset_type ? editingView.asset_type : activeType;
      const normalized = mergeViewAssetTypeFilter(normalizeFilters(filters), assetType);
      setColumnFilters(normalized);
      setAppliedFilters(normalized);
      clearView();

      if (includeSort && sortField) {
        setSort(sortField, sortDirection || 'desc');
      }

      if (includeSearch && search?.trim()) {
        setSearch(search.trim());
      } else if (!includeSearch) {
        setSearch('');
      }

      setStatusFilter('all');
    },
    [
      activeType,
      clearView,
      editingView,
      filterModalMode,
      search,
      setSort,
      sortDirection,
      sortField,
      setColumnFilters,
      setAppliedFilters,
      setSearch,
      setStatusFilter,
    ]
  );

  const sidebarProps = {
    apiKey,
    views,
    activeView,
    tags,
    enrichedDownloads,
    activeAssetType: activeType,
    activeTagIds,
    onApplyView: handleApplyView,
    onClearView: handleClearFilters,
    onApplyTag: handleApplyTag,
    onEditView: handleEditView,
    onRenameView: handleRenameView,
    onRenameTag: handleRenameTag,
    onDeleteTag: handleTagDeleted,
    onNewFilter: handleOpenNewFilter,
    onNewView: handleOpenNewView,
    onNewTag: handleNewTag,
    onManageTags: handleManageTags,
  };

  const downloadsTableContent = (
    <>
      {isBackendAvailable && (
        <ActiveFiltersBar
          appliedFilters={appliedFilters}
          activeView={activeView}
          tags={tags}
          onClear={handleClearFilters}
          onEdit={handleOpenNewFilter}
        />
      )}
      <ActionBar
        unfilteredItems={enrichedDownloads}
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
        onBulkDownload={() => handleBulkDownload(selectedItems, enrichedDownloads)}
        isDeleting={isDeleting}
        onBulkDelete={(includeParentDownloads) =>
          deleteItems(selectedItems, includeParentDownloads, enrichedDownloads)
        }
        isExporting={isExporting}
        onBulkExport={handleBulkExport}
        activeType={activeType}
        isBlurred={isBlurred}
        onBlurToggle={() => setIsBlurred(!isBlurred)}
        isFullscreen={isFullscreen}
        onFullscreenToggle={onFullscreenToggle}
        viewMode={displayViewMode}
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
        hasFiltersSidebar={filtersSidebarExpanded}
      />

      {displayViewMode === 'table' ? (
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
            setPauseReason('videoPlayer', true);
          }}
          onAudioPlay={handleAudioPlay}
          fileSearch={search}
        />
      ) : (
        <CardList
          items={sortedItems}
          fileSearch={search}
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
          viewMode={displayViewMode}
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
            setPauseReason('videoPlayer', true);
          }}
          onAudioPlay={handleAudioPlay}
        />
      )}
    </>
  );

  return (
    <div
      className={`space-y-2 mt-1.5 transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        showDesktopFiltersSidebar ? 'md:pl-[var(--downloads-sidebar-width)]' : ''
      }`}
      style={
        showDesktopFiltersSidebar
          ? {
              '--downloads-sidebar-width': filtersSidebarWidth,
              '--downloads-content-left': `calc(var(--sidebar-width, 0px) + ${filtersSidebarWidth})`,
            }
          : undefined
      }
    >
      {onApiKeyChange && (
        <ApiKeyInput
          value={apiKey}
          onKeyChange={onApiKeyChange}
          allowKeyManager={true}
          variant="compact"
        />
      )}

      {/* Asset Type Tabs + auto-refresh countdown */}
      <div className="relative [&_nav]:pr-11 md:[&_nav]:pr-0">
        <AssetTypeTabs
          activeType={activeType}
          onTypeChange={(type) => {
            setActiveType(type);
            localStorage.setItem(ASSET_TYPE_STORAGE_KEY, type);
            setSelectedItems({ items: new Set(), files: new Map() });
          }}
          isTypeAvailable={(type) => {
            if (type === 'all') return true;
            // For download tabs, defer to the generic permissions helper
            if (type === 'usenet') {
              return hasDownloadAccess('usenet', permissions);
            }
            return true;
          }}
        />
        {apiKey && (
          <AutoRefreshIndicator
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 sm:right-3"
            pollSchedule={pollSchedule}
            isRefreshing={isRefreshing}
            refreshRateLimited={!canManualRefresh}
            onRefreshNow={() => fetchItems(true)}
          />
        )}
      </div>

      <FetchStatusBanner
        error={fetchError}
        onDismissError={dismissError}
        onRetry={() => fetchItems(true)}
        lastSuccessfulFetchAt={lastSuccessfulFetchAt}
        refreshBlockedReason={refreshBlockedReason}
        pollingPaused={pollingPaused}
      />

      {isRefreshing && (
        <p className="text-xs text-secondary-text dark:text-secondary-text-dark text-center py-1">
          {fetchStatusT('refreshing')}
        </p>
      )}

      {/* Loading State — full spinner only when there is nothing to show yet */}
      {showFullPageSpinner ? (
        <div className="flex justify-center items-center py-12">
          <Spinner size="sm" className="text-primary-text dark:text-primary-text-dark" />
        </div>
      ) : (
        <>
          {/* Upload section */}
          <Uploaders apiKey={apiKey} activeType={activeType} permissions={permissions} />

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

          {apiKey && <UsageCallout apiKey={apiKey} planId={permissions?.planId} />}

          <ReferralCallout apiKey={apiKey} variant="compact" onToast={setToast} />

          {isBackendAvailable && isMobile && (
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border dark:border-border-dark rounded-md hover:bg-surface-alt dark:hover:bg-surface-alt-dark md:hidden"
            >
              <svg
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              {downloadsFiltersT('sidebarLabel')}
            </button>
          )}

          {showDesktopFiltersSidebar && (
            <FiltersSidebar
              {...sidebarProps}
              variant="fixed"
              className="hidden md:flex"
              collapsed={filtersSidebarCollapsed}
              onToggleCollapsed={toggleFiltersSidebar}
            />
          )}

          <div
            ref={scrollContainerRef}
            className={`min-w-0 ${isFullscreen ? 'fixed inset-0 z-50 bg-surface dark:bg-surface-dark overflow-auto' : 'relative z-[1]'} ${
              downloadLinks.length > 0 ? 'mb-12' : ''
            }`}
          >
            {downloadsTableContent}
          </div>

          {isBackendAvailable && (
            <>
              <MobileFiltersDrawer
                isOpen={mobileFiltersOpen}
                onClose={() => setMobileFiltersOpen(false)}
                sidebarProps={sidebarProps}
              />
              <FilterEditorModal
                isOpen={filterModalOpen}
                onClose={handleCloseFilterModal}
                mode={filterModalMode || 'filter'}
                editingView={editingView}
                apiKey={apiKey}
                activeType={activeType}
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
                onApply={handleApplyFiltersFromModal}
                onPreview={handlePreviewFiltersFromModal}
                previewItems={enrichedDownloads}
                onViewCreated={handleViewCreated}
                onViewUpdated={handleViewUpdated}
                sortField={sortField}
                sortDirection={sortDirection}
                activeColumns={activeColumns}
                search={search}
              />
              <TagManager
                isOpen={tagManagerOpen}
                onClose={() => {
                  setTagManagerOpen(false);
                  setTagManagerAutoCreate(false);
                }}
                apiKey={apiKey}
                initialCreating={tagManagerAutoCreate}
              />
            </>
          )}
          <VideoPlayerModal
            isOpen={videoPlayerState.isOpen}
            onClose={() => {
              setPauseReason('videoPlayer', false);
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
              });
            }}
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
              key={`${audioPlayerState.fileId}-${audioPlayerState.itemId}`}
              audioUrl={audioPlayerState.url}
              fileName={audioPlayerState.fileName}
              itemId={audioPlayerState.itemId}
              fileId={audioPlayerState.fileId}
              assetType={audioPlayerState.assetType}
              apiKey={audioPlayerState.apiKey}
              onClose={() => {
                setPauseReason('audioPlayer', false);
                setAudioPlayerState({
                  isOpen: false,
                  url: null,
                  itemId: null,
                  fileId: null,
                  assetType: 'torrent',
                  fileName: null,
                  apiKey: null,
                });
              }}
              onRefreshUrl={handleAudioRefreshUrl}
            />
          )}
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

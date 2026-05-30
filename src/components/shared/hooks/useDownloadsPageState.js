'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useColumnManager } from './useColumnManager';
import { useDownloads } from './useDownloads';
import { useDownloadsHistoryMigration } from './useDownloadsHistoryMigration';
import { useDownloadsFilters } from './useDownloadsFilters';
import { useDownloadsListData } from './useDownloadsListData';
import { useDelete } from './useDelete';
import { useFetchData } from './useFetchData';
import { useSelection } from './useSelection';
import useIsMobile from '../../../hooks/useIsMobile';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { usePollingPauseStore, selectIsPaused } from '@/store/pollingPauseStore';
import { useSessionStore } from '@/store/sessionStore';
import { useBackendMode } from '@/hooks/useBackendMode';
import useDownloadsViewMode from '@/hooks/useDownloadsViewMode';
import useStoredAssetType from '@/hooks/useStoredAssetType';
import { useEnsureUserDb } from '@/components/shared/hooks/useEnsureUserDb';
import { useBulkExport } from '@/components/downloads/hooks/useBulkExport';
import { useDownloadsSearchExpand } from '@/components/downloads/hooks/useDownloadsSearchExpand';
import { hasDownloadAccess } from '@/utils/userProfile';
import { buildSelectionIdMap } from '@/utils/downloadSelectionId';
import { formatSize } from '@/components/downloads/utils/formatters';
import { useTranslations } from 'next-intl';
import useFiltersSidebarCollapsed from '@/components/downloads/FiltersSidebar/useFiltersSidebarCollapsed';
import { useDownloadsPlayerActions } from '@/components/downloads/DownloadsPlayersHost';

export const FILTERS_SIDEBAR_EXPANDED = '14rem';
export const FILTERS_SIDEBAR_COLLAPSED = '2.5rem';

/**
 * Orchestrates data fetching, filtering, selection, and UI state for Downloads.js.
 */
export function useDownloadsPageState(apiKey) {
  const downloadPanelT = useTranslations('DownloadPanel');
  const pollingPaused = usePollingPauseStore(selectIsPaused);
  const permissions = useSessionStore((state) => state.permissions);
  const { expandedById, expandIds, collapseAllExpanded, toggleExpanded, setExpanded } =
    useDownloadsUiStore(
      useShallow((s) => ({
        expandedById: s.expandedById,
        expandIds: s.expandIds,
        collapseAllExpanded: s.collapseAll,
        toggleExpanded: s.toggleExpanded,
        setExpanded: s.setExpanded,
      }))
    );

  const { activeType, setActiveType } = useStoredAssetType();
  const { viewMode, setViewMode } = useDownloadsViewMode();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [toast, setToast] = useState(null);
  const hasExpandedRef = useRef(false);
  const scrollContainerRef = useRef(null);
  const isMobile = useIsMobile();
  const displayViewMode = isMobile ? 'card' : viewMode;
  const { collapsed: filtersSidebarCollapsed, toggleCollapsed: toggleFiltersSidebar } =
    useFiltersSidebarCollapsed();
  const { mode: backendMode, isLoading: backendIsLoading } = useBackendMode();
  const isBackendAvailable = backendMode === 'backend';

  useEnsureUserDb(apiKey);

  const canUseUsenet = hasDownloadAccess('usenet', permissions);

  const {
    loading,
    refreshing,
    error: fetchError,
    fetchItems,
    dismissError,
    lastSuccessfulFetchAt,
    refreshBlockedReason,
    pollSchedule,
    canManualRefresh,
  } = useFetchData(apiKey, activeType);

  const {
    viewItems,
    sortedItems,
    visibleIds,
    downloadHistory,
    downloadHistoryLookup,
    tags,
    tagMappings,
    updateTagName,
  } = useDownloadsListData(activeType, apiKey, isBackendAvailable);

  const showFullPageSpinner = loading && viewItems.length === 0;
  const isRefreshing = refreshing || (loading && viewItems.length > 0);

  const { fetchDownloadHistory } = useDownloadsHistoryMigration(
    apiKey,
    isBackendAvailable,
    backendIsLoading
  );

  const {
    selectedItems,
    handleSelectAll,
    handleFileSelect,
    setSelectedItems,
  } = useSelection(viewItems, activeType, apiKey);

  useEffect(() => {
    if (!canUseUsenet && activeType === 'usenet') {
      setActiveType('all');
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
    downloadSingle,
  } = useDownloads(
    apiKey,
    activeType,
    downloadHistory,
    fetchDownloadHistory,
    handleBulkDownloadComplete
  );

  const downloadActions = useMemo(
    () => ({ downloadSingle, requestDownloadLink }),
    [downloadSingle, requestDownloadLink]
  );

  const { isDeleting, deleteItem, deleteItems } = useDelete(
    apiKey,
    setSelectedItems,
    setToast,
    fetchItems,
    activeType
  );

  const { activeColumns, handleColumnChange } = useColumnManager(activeType);

  const filterData = useDownloadsFilters({
    apiKey,
    isBackendAvailable,
    activeType,
    setToast,
    handleColumnChange,
    updateTagName,
  });

  const { handleAudioPlay, openVideoPlayer } = useDownloadsPlayerActions(
    apiKey,
    activeType,
    requestDownloadLink,
    setToast
  );

  const { searchExpandedItemIdsRef, collapseAllFiles } = useDownloadsSearchExpand({
    search: filterData.search,
    sortedItems,
    selectedItems,
    expandedById,
    setExpanded,
    collapseAllExpanded,
  });

  const expandAllFiles = useCallback(() => {
    searchExpandedItemIdsRef.current = new Set();
    const itemIds = viewItems
      .filter((item) => item.files && item.files.length > 0)
      .map((item) => item.id);
    expandIds(itemIds);
  }, [viewItems, expandIds, searchExpandedItemIdsRef]);

  const { isExporting, handleBulkExport } = useBulkExport(
    apiKey,
    activeType,
    selectedItems,
    viewItems,
    setToast
  );

  const onFullscreenToggle = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  useLayoutEffect(() => {
    if (isFullscreen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isFullscreen]);

  const toggleFiles = useCallback(
    (itemId) => {
      searchExpandedItemIdsRef.current.delete(itemId);
      toggleExpanded(itemId);
    },
    [toggleExpanded, searchExpandedItemIdsRef]
  );

  useEffect(() => {
    hasExpandedRef.current = false;
  }, [activeType, apiKey]);

  useEffect(() => {
    if (!viewItems?.length || !selectedItems?.files?.size) return;
    if (hasExpandedRef.current) return;

    const itemMap = buildSelectionIdMap(viewItems);
    selectedItems.files.forEach((_, selectionId) => {
      const item = itemMap.get(selectionId);
      if (item?.id != null) {
        setExpanded(item.id, true);
      }
    });

    hasExpandedRef.current = true;
  }, [viewItems, selectedItems.files, setExpanded]);

  const getTotalDownloadSize = useCallback(() => {
    if (viewItems.length === 0) return formatSize(0);
    if (selectedItems.items.size === 0 && selectedItems.files.size === 0) return formatSize(0);

    const itemMap = buildSelectionIdMap(viewItems);

    const filesSize = Array.from(selectedItems.files.entries()).reduce((acc, [selectionId, fileIds]) => {
      const item = itemMap.get(selectionId);
      if (!item) return acc;
      const fileIdSet = new Set(fileIds);
      const files = item.files || [];
      for (let i = 0; i < files.length; i++) {
        if (fileIdSet.has(files[i].id)) {
          acc += files[i].size || 0;
        }
      }
      return acc;
    }, 0);

    const itemsSize = Array.from(selectedItems.items).reduce((acc, selectionId) => {
      const item = itemMap.get(selectionId);
      return acc + (item?.size || 0);
    }, 0);

    return formatSize(filesSize + itemsSize);
  }, [viewItems, selectedItems]);

  const showDesktopFiltersSidebar = isBackendAvailable && !isMobile && !isFullscreen;
  const filtersSidebarExpanded = showDesktopFiltersSidebar && !filtersSidebarCollapsed;

  const sidebarProps = useMemo(
    () => ({
      apiKey,
      views: filterData.views,
      activeView: filterData.activeView,
      tags,
      activeAssetType: activeType,
      activeTagIds: filterData.activeTagIds,
      onApplyView: filterData.handleApplyView,
      onClearView: filterData.handleClearFilters,
      onApplyTag: filterData.handleApplyTag,
      onEditView: filterData.handleEditView,
      onRenameView: filterData.handleRenameView,
      onRenameTag: filterData.handleRenameTag,
      onDeleteTag: filterData.handleTagDeleted,
      onNewFilter: filterData.handleOpenNewFilter,
      onNewView: filterData.handleOpenNewView,
      onOpenTagManager: filterData.handleOpenTagManager,
    }),
    [
      apiKey, filterData.views, filterData.activeView, tags, activeType,
      filterData.activeTagIds, filterData.handleApplyView, filterData.handleClearFilters,
      filterData.handleApplyTag, filterData.handleEditView, filterData.handleRenameView,
      filterData.handleRenameTag, filterData.handleTagDeleted,
      filterData.handleOpenNewFilter, filterData.handleOpenNewView,
      filterData.handleOpenTagManager,
    ]
  );

  const downloadsDataContextValue = useMemo(
    () => ({
      viewItems,
      sortedItems,
      visibleIds,
      activeColumns,
      downloadHistoryLookup,
      tagMappings,
    }),
    [viewItems, sortedItems, visibleIds, activeColumns, downloadHistoryLookup, tagMappings]
  );

  const downloadsFilterContextValue = useMemo(
    () => ({
      appliedFilters: filterData.appliedFilters,
      activeView: filterData.activeView,
      tags,
      handleClearFilters: filterData.handleClearFilters,
      handleOpenNewFilter: filterData.handleOpenNewFilter,
      handleColumnChange,
      search: filterData.search,
      setSearch: filterData.setSearch,
      statusFilter: filterData.statusFilter,
      setStatusFilter: filterData.setStatusFilter,
      sortField: filterData.sortField,
      sortDirection: filterData.sortDirection,
      handleSort: filterData.handleSort,
    }),
    [
      filterData.appliedFilters,
      filterData.activeView,
      tags,
      filterData.handleClearFilters,
      filterData.handleOpenNewFilter,
      handleColumnChange,
      filterData.search,
      filterData.setSearch,
      filterData.statusFilter,
      filterData.setStatusFilter,
      filterData.sortField,
      filterData.sortDirection,
      filterData.handleSort,
    ]
  );

  const downloadsUIContextValue = useMemo(
    () => ({
      isBackendAvailable,
      activeType,
      isBlurred,
      setIsBlurred,
      isFullscreen,
      onFullscreenToggle,
      displayViewMode,
      setViewMode,
      isDownloadPanelOpen,
      setIsDownloadPanelOpen,
      scrollContainerRef,
      filtersSidebarExpanded,
      expandAllFiles,
      collapseAllFiles,
    }),
    [
      isBackendAvailable,
      activeType,
      isBlurred,
      setIsBlurred,
      isFullscreen,
      onFullscreenToggle,
      displayViewMode,
      setViewMode,
      isDownloadPanelOpen,
      setIsDownloadPanelOpen,
      scrollContainerRef,
      filtersSidebarExpanded,
      expandAllFiles,
      collapseAllFiles,
    ]
  );

  const downloadsContextValue = useMemo(
    () => ({
      isDownloading,
      handleBulkDownload,
      isDeleting,
      deleteItems,
      isExporting,
      handleBulkExport,
      getTotalDownloadSize,
      apiKey,
      setToast,
      handleFileSelect,
      setSelectedItems,
      handleSelectAll,
      deleteItem,
      toggleFiles,
      onOpenVideoPlayer: openVideoPlayer,
      onAudioPlay: handleAudioPlay,
    }),
    [
      isDownloading,
      handleBulkDownload,
      isDeleting,
      deleteItems,
      isExporting,
      handleBulkExport,
      getTotalDownloadSize,
      apiKey,
      setToast,
      handleFileSelect,
      setSelectedItems,
      handleSelectAll,
      deleteItem,
      toggleFiles,
      openVideoPlayer,
      handleAudioPlay,
    ]
  );

  return {
    toast,
    setToast,
    pollingPaused,
    permissions,
    activeType,
    setActiveType,
    isFullscreen,
    isMobile,
    isDownloadPanelOpen,
    setIsDownloadPanelOpen,
    scrollContainerRef,
    filtersSidebarCollapsed,
    toggleFiltersSidebar,
    isBackendAvailable,
    canUseUsenet,
    fetchError,
    fetchItems,
    dismissError,
    lastSuccessfulFetchAt,
    refreshBlockedReason,
    pollSchedule,
    canManualRefresh,
    viewItems,
    showFullPageSpinner,
    isRefreshing,
    downloadLinks,
    isDownloading,
    downloadProgress,
    setDownloadLinks,
    requestDownloadLink,
    sidebarProps,
    filterData,
    activeColumns,
    downloadsDataContextValue,
    downloadsFilterContextValue,
    downloadsUIContextValue,
    downloadsContextValue,
    downloadActions,
    showDesktopFiltersSidebar,
  };
}

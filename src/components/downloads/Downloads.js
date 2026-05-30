'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useColumnManager } from '../shared/hooks/useColumnManager';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useDownloadsHistoryMigration } from '../shared/hooks/useDownloadsHistoryMigration';
import DownloadsPlayersHost, {
  useDownloadsPlayerActions,
} from './DownloadsPlayersHost';
import { useDownloadsFilters } from '../shared/hooks/useDownloadsFilters';
import { useDownloadsListData } from '../shared/hooks/useDownloadsListData';
import { DownloadsActionsProvider } from './DownloadsActionsContext';
import { DownloadsProvider } from './DownloadsContext';
import { useDelete } from '../shared/hooks/useDelete';
import { useFetchData } from '../shared/hooks/useFetchData';
import { useSelection } from '../shared/hooks/useSelection';
import useIsMobile from '../../hooks/useIsMobile';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import { useSessionStore } from '@/store/sessionStore';
import { useBackendMode } from '@/hooks/useBackendMode';
import useDownloadsViewMode from '@/hooks/useDownloadsViewMode';
import useStoredAssetType from '@/hooks/useStoredAssetType';
import { useEnsureUserDb } from '@/components/shared/hooks/useEnsureUserDb';
import { useBulkExport } from './hooks/useBulkExport';
import { useDownloadsSearchExpand } from './hooks/useDownloadsSearchExpand';
import { hasDownloadAccess } from '@/utils/userProfile';
import { buildSelectionIdMap } from '@/utils/downloadSelectionId';
import { formatSize } from './utils/formatters';
import { useTranslations } from 'next-intl';

import DownloadsHeader from './DownloadsHeader';
import DownloadsInfoPanel from './DownloadsInfoPanel';
import DownloadsContentArea from './DownloadsContentArea';
import DownloadsModals from './DownloadsModals';
import FiltersSidebar from './FiltersSidebar';
import useFiltersSidebarCollapsed from './FiltersSidebar/useFiltersSidebarCollapsed';
import Toast from '@/components/shared/Toast';
import Spinner from '../shared/Spinner';

const FILTERS_SIDEBAR_EXPANDED = '14rem';
const FILTERS_SIDEBAR_COLLAPSED = '2.5rem';

export default function Downloads({ apiKey, onApiKeyChange }) {
  const fetchStatusT = useTranslations('FetchStatus');
  const pollingPaused = usePollingPauseStore((state) => state.isPaused);
  const [toast, setToast] = useState(null);
  const { activeType, setActiveType } = useStoredAssetType();
  const permissions = useSessionStore((state) => state.permissions);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const { viewMode, setViewMode } = useDownloadsViewMode();
  const expandedById = useDownloadsUiStore((state) => state.expandedById);
  const expandIds = useDownloadsUiStore((state) => state.expandIds);
  const collapseAllExpanded = useDownloadsUiStore((state) => state.collapseAll);
  const toggleExpanded = useDownloadsUiStore((state) => state.toggleExpanded);
  const setExpanded = useDownloadsUiStore((state) => state.setExpanded);
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
  const downloadPanelT = useTranslations('DownloadPanel');
  const downloadsFiltersT = useTranslations('DownloadsFilters');

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

  const downloadsContextValue = useMemo(
    () => ({
      isBackendAvailable,
      appliedFilters: filterData.appliedFilters,
      activeView: filterData.activeView,
      tags,
      handleClearFilters: filterData.handleClearFilters,
      handleOpenNewFilter: filterData.handleOpenNewFilter,
      viewItems,
      sortedItems,
      visibleIds,
      activeColumns,
      handleColumnChange,
      search: filterData.search,
      setSearch: filterData.setSearch,
      statusFilter: filterData.statusFilter,
      setStatusFilter: filterData.setStatusFilter,
      isDownloading,
      handleBulkDownload,
      selectedItems,
      isDeleting,
      deleteItems,
      isExporting,
      handleBulkExport,
      activeType,
      isBlurred,
      setIsBlurred,
      isFullscreen,
      onFullscreenToggle,
      displayViewMode,
      setViewMode,
      sortField: filterData.sortField,
      sortDirection: filterData.sortDirection,
      handleSort: filterData.handleSort,
      getTotalDownloadSize,
      isDownloadPanelOpen,
      setIsDownloadPanelOpen,
      apiKey,
      setToast,
      expandAllFiles,
      collapseAllFiles,
      scrollContainerRef,
      filtersSidebarExpanded,
      handleFileSelect,
      setSelectedItems,
      handleSelectAll,
      downloadHistoryLookup,
      tagMappings,
      deleteItem,
      toggleFiles,
      onOpenVideoPlayer: openVideoPlayer,
      onAudioPlay: handleAudioPlay,
      fileSearch: filterData.search,
    }),
    [
      isBackendAvailable,
      filterData.appliedFilters,
      filterData.activeView,
      tags,
      filterData.handleClearFilters,
      filterData.handleOpenNewFilter,
      viewItems,
      sortedItems,
      visibleIds,
      activeColumns,
      handleColumnChange,
      filterData.search,
      filterData.setSearch,
      filterData.statusFilter,
      filterData.setStatusFilter,
      isDownloading,
      handleBulkDownload,
      selectedItems,
      isDeleting,
      deleteItems,
      isExporting,
      handleBulkExport,
      activeType,
      isBlurred,
      setIsBlurred,
      isFullscreen,
      onFullscreenToggle,
      displayViewMode,
      setViewMode,
      filterData.sortField,
      filterData.sortDirection,
      filterData.handleSort,
      getTotalDownloadSize,
      isDownloadPanelOpen,
      setIsDownloadPanelOpen,
      apiKey,
      setToast,
      expandAllFiles,
      collapseAllFiles,
      scrollContainerRef,
      filtersSidebarExpanded,
      handleFileSelect,
      setSelectedItems,
      handleSelectAll,
      downloadHistoryLookup,
      tagMappings,
      deleteItem,
      toggleFiles,
      openVideoPlayer,
      handleAudioPlay,
    ]
  );
  const filtersSidebarWidth = filtersSidebarCollapsed
    ? FILTERS_SIDEBAR_COLLAPSED
    : FILTERS_SIDEBAR_EXPANDED;

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
      <DownloadsHeader
        apiKey={apiKey}
        onApiKeyChange={onApiKeyChange}
        activeType={activeType}
        setActiveType={setActiveType}
        isTypeAvailable={(type) => {
          if (type === 'all') return true;
          if (type === 'usenet') return hasDownloadAccess('usenet', permissions);
          return true;
        }}
        pollSchedule={pollSchedule}
        isRefreshing={isRefreshing}
        canManualRefresh={canManualRefresh}
        fetchItems={fetchItems}
        fetchError={fetchError}
        dismissError={dismissError}
        lastSuccessfulFetchAt={lastSuccessfulFetchAt}
        refreshBlockedReason={refreshBlockedReason}
        pollingPaused={pollingPaused}
        fetchStatusT={fetchStatusT}
      />

      {showFullPageSpinner ? (
        <div className="flex justify-center items-center py-12">
          <Spinner size="sm" className="text-primary-text dark:text-primary-text-dark" />
        </div>
      ) : (
        <>
          <DownloadsInfoPanel
            apiKey={apiKey}
            activeType={activeType}
            permissions={permissions}
            downloadLinks={downloadLinks}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            setDownloadLinks={setDownloadLinks}
            isDownloadPanelOpen={isDownloadPanelOpen}
            setIsDownloadPanelOpen={setIsDownloadPanelOpen}
            setToast={setToast}
          />

          {isBackendAvailable && isMobile && (
            <button
              type="button"
              onClick={() => filterData.setMobileFiltersOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border dark:border-border-dark rounded-md hover:bg-surface-alt dark:hover:bg-surface-alt-dark md:hidden"
              aria-label={downloadsFiltersT('sidebarLabel')}
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
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
            <DownloadsActionsProvider value={downloadActions}>
              <DownloadsProvider value={downloadsContextValue}>
                <DownloadsContentArea />
              </DownloadsProvider>
            </DownloadsActionsProvider>
          </div>

          {isBackendAvailable && (
              <DownloadsModals
                isBackendAvailable={isBackendAvailable}
                mobileFiltersOpen={filterData.mobileFiltersOpen}
                setMobileFiltersOpen={filterData.setMobileFiltersOpen}
                sidebarProps={sidebarProps}
                filterModalOpen={filterData.filterModalOpen}
                handleCloseFilterModal={filterData.handleCloseFilterModal}
                filterModalMode={filterData.filterModalMode}
                editingView={filterData.editingView}
                apiKey={apiKey}
                activeType={activeType}
                columnFilters={filterData.columnFilters}
                setColumnFilters={filterData.setColumnFilters}
                handleApplyFiltersFromModal={filterData.handleApplyFiltersFromModal}
                handlePreviewFiltersFromModal={filterData.handlePreviewFiltersFromModal}
                viewItems={viewItems}
                handleViewCreated={filterData.handleViewCreated}
                handleViewUpdated={filterData.handleViewUpdated}
                sortField={filterData.sortField}
                sortDirection={filterData.sortDirection}
                activeColumns={activeColumns}
                search={filterData.search}
                tagManagerOpen={filterData.tagManagerOpen}
                setTagManagerOpen={filterData.setTagManagerOpen}
              />
          )}

          <DownloadsPlayersHost
            apiKey={apiKey}
            activeType={activeType}
            requestDownloadLink={requestDownloadLink}
          />
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

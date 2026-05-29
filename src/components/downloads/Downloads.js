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
import { useDelete } from '../shared/hooks/useDelete';
import { useFetchData } from '../shared/hooks/useFetchData';
import { useSelection } from '../shared/hooks/useSelection';
import useIsMobile from '../../hooks/useIsMobile';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';

import AssetTypeTabs from '@/components/shared/AssetTypeTabs';
import DownloadPanel from './DownloadPanel';
import DownloadsUploaders from './DownloadsUploaders';
import SpeedChart from './SpeedChart';
import Toast from '@/components/shared/Toast';
import Spinner from '../shared/Spinner';
import ItemsTable from './ItemsTable';
import ActionBar from './ActionBar/index';
import CardList from './CardList';
import FiltersSidebar from './FiltersSidebar';
import useFiltersSidebarCollapsed from './FiltersSidebar/useFiltersSidebarCollapsed';
import MobileFiltersDrawer from './FiltersSidebar/MobileFiltersDrawer';
import FilterEditorModal from './FilterEditorModal';
import TagManager from './Tags/TagManager';
import ActiveFiltersBar from './ActiveFiltersBar';
import { useDownloadsSearchExpand } from './hooks/useDownloadsSearchExpand';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import { formatSize } from './utils/formatters';
import { findItemBySelectionId } from '@/utils/downloadSelectionId';
import { hasDownloadAccess } from '@/utils/userProfile';
import { useBackendMode } from '@/hooks/useBackendMode';
import useDownloadsViewMode from '@/hooks/useDownloadsViewMode';
import useStoredAssetType from '@/hooks/useStoredAssetType';
import { useEnsureUserDb } from '@/components/shared/hooks/useEnsureUserDb';
import { useSessionStore } from '@/store/sessionStore';
import ReferralCallout from '@/components/referral/ReferralCallout';
import UsageCallout from '@/components/downloads/UsageCallout';
import ApiKeyInput from '@/components/downloads/ApiKeyInput';
import FetchStatusBanner from '@/components/downloads/FetchStatusBanner';
import AutoRefreshIndicator from '@/components/downloads/AutoRefreshIndicator';
import { useTranslations } from 'next-intl';

const FILTERS_SIDEBAR_EXPANDED = '14rem';
const FILTERS_SIDEBAR_COLLAPSED = '2.5rem';

export default function Downloads({ apiKey, onApiKeyChange }) {
  const downloadPanelT = useTranslations('DownloadPanel');
  const fetchStatusT = useTranslations('FetchStatus');
  const downloadsFiltersT = useTranslations('DownloadsFilters');
  const pollingPaused = usePollingPauseStore((state) =>
    Object.values(state.pauseReasons).some((isPaused) => isPaused === true)
  );
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
  const [isExporting, setIsExporting] = useState(false);
  const hasExpandedRef = useRef(false);
  const scrollContainerRef = useRef(null);
  const isMobile = useIsMobile();
  /** Mobile always uses card layout; desktop preference is preserved in viewMode. */
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

  // If usenet is selected but user doesn't have Pro plan, switch to all
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

  const {
    columnFilters,
    setColumnFilters,
    appliedFilters,
    filterModalOpen,
    filterModalMode,
    editingView,
    tagManagerOpen,
    setTagManagerOpen,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortField,
    sortDirection,
    handleSort,
    views,
    activeView,
    activeTagIds,
    handleApplyView,
    handleClearFilters,
    handleApplyTag,
    handleCloseFilterModal,
    handleEditView,
    handleViewCreated,
    handleViewUpdated,
    handleRenameView,
    handleRenameTag,
    handleTagDeleted,
    handleOpenNewFilter,
    handleOpenNewView,
    handleOpenTagManager,
    handleApplyFiltersFromModal,
    handlePreviewFiltersFromModal,
  } = useDownloadsFilters({
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
    search,
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

  const onFullscreenToggle = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

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

      let successCount = 0;
      let failCount = 0;

      await Promise.all(
        selectedItemIds.map(async (selectionId) => {
          const item = findItemBySelectionId(viewItems, selectionId);
          if (!item) {
            failCount += 1;
            return;
          }

          try {
            const response = await fetch(
              `/api/torrents/export?torrent_id=${item.id}&type=torrent`,
              {
                headers: {
                  'x-api-key': apiKey,
                },
              }
            );

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
              successCount += 1;
            } else {
              failCount += 1;
              console.error(`Failed to export torrent ${selectionId}`);
            }
          } catch (error) {
            failCount += 1;
            console.error(`Error exporting torrent ${selectionId}:`, error);
          }
        })
      );

      if (failCount === 0) {
        setToast({
          message: `Exported ${successCount} torrent file${successCount === 1 ? '' : 's'}`,
          type: 'success',
        });
      } else if (successCount === 0) {
        setToast({
          message: 'Failed to export torrent files',
          type: 'error',
        });
      } else {
        setToast({
          message: `Exported ${successCount} of ${selectedItemIds.length} torrent files`,
          type: 'warning',
        });
      }
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

  const toggleFiles = useCallback(
    (itemId) => {
      searchExpandedItemIdsRef.current.delete(itemId);
      toggleExpanded(itemId);
    },
    [toggleExpanded]
  );

  useEffect(() => {
    hasExpandedRef.current = false;
  }, [activeType, apiKey]);

  useEffect(() => {
    if (!viewItems?.length || !selectedItems?.files?.size) return;
    if (hasExpandedRef.current) return;

    selectedItems.files.forEach((_, selectionId) => {
      const item = findItemBySelectionId(viewItems, selectionId);
      if (item?.id != null) {
        setExpanded(item.id, true);
      }
    });

    hasExpandedRef.current = true;
  }, [viewItems, selectedItems.files, setExpanded]);

  // Get the total size of all selected items and files
  const getTotalDownloadSize = useCallback(() => {
    // Calculate size of selected files
    const filesSize = Array.from(selectedItems.files.entries()).reduce((acc, [selectionId, fileIds]) => {
      const item = findItemBySelectionId(viewItems, selectionId);
      if (!item) return acc;

      return (
        acc +
        Array.from(fileIds).reduce((sum, fileId) => {
          const file = item.files.find((f) => f.id === fileId);
          return sum + (file?.size || 0);
        }, 0)
      );
    }, 0);

    const itemsSize = Array.from(selectedItems.items).reduce((acc, selectionId) => {
      const item = findItemBySelectionId(viewItems, selectionId);
      return acc + (item?.size || 0);
    }, 0);

    return formatSize(filesSize + itemsSize);
  }, [viewItems, selectedItems]);

  const showDesktopFiltersSidebar = isBackendAvailable && !isMobile && !isFullscreen;
  const filtersSidebarExpanded = showDesktopFiltersSidebar && !filtersSidebarCollapsed;
  const filtersSidebarWidth = filtersSidebarCollapsed
    ? FILTERS_SIDEBAR_COLLAPSED
    : FILTERS_SIDEBAR_EXPANDED;

  const sidebarProps = useMemo(
    () => ({
      apiKey,
      views,
      activeView,
      tags,
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
      onOpenTagManager: handleOpenTagManager,
    }),
    [
      apiKey,
      views,
      activeView,
      tags,
      activeType,
      activeTagIds,
      handleApplyView,
      handleClearFilters,
      handleApplyTag,
      handleEditView,
      handleRenameView,
      handleRenameTag,
      handleTagDeleted,
      handleOpenNewFilter,
      handleOpenNewView,
      handleOpenTagManager,
    ]
  );

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
        unfilteredItems={viewItems}
        filteredItems={sortedItems}
        activeColumns={activeColumns}
        onColumnChange={handleColumnChange}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        isDownloading={isDownloading}
        onBulkDownload={() => handleBulkDownload(selectedItems, viewItems)}
        isDeleting={isDeleting}
        onBulkDelete={(includeParentDownloads) =>
          deleteItems(selectedItems, includeParentDownloads, viewItems)
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
        scrollContainerRef={scrollContainerRef}
        hasFiltersSidebar={filtersSidebarExpanded}
      />

      {displayViewMode === 'table' ? (
        <ItemsTable
          apiKey={apiKey}
          activeType={activeType}
          activeColumns={activeColumns}
          selectedItems={selectedItems}
          handleSelectAll={handleSelectAll}
          handleFileSelect={handleFileSelect}
          setSelectedItems={setSelectedItems}
          downloadHistoryLookup={downloadHistoryLookup}
          tagMappings={tagMappings}
          isBlurred={isBlurred}
          deleteItem={deleteItem}
          sortedItems={sortedItems}
          sortField={sortField}
          sortDirection={sortDirection}
          handleSort={handleSort}
          setToast={setToast}
          toggleFiles={toggleFiles}
          isFullscreen={isFullscreen}
          scrollContainerRef={scrollContainerRef}
          onOpenVideoPlayer={openVideoPlayer}
          onAudioPlay={handleAudioPlay}
          fileSearch={search}
        />
      ) : (
        <CardList
          entityKeys={visibleIds}
          tagMappings={tagMappings}
          fileSearch={search}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          apiKey={apiKey}
          activeColumns={activeColumns}
          onFileSelect={handleFileSelect}
          downloadHistoryLookup={downloadHistoryLookup}
          onDelete={deleteItem}
          toggleFiles={toggleFiles}
          setToast={setToast}
          activeType={activeType}
          isBlurred={isBlurred}
          isFullscreen={isFullscreen}
          viewMode={displayViewMode}
          scrollContainerRef={scrollContainerRef}
          onOpenVideoPlayer={openVideoPlayer}
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

      {/* Asset Type Tabs + auto-refresh countdown (flex on mobile avoids covering webdl tab) */}
      <div className="relative flex items-center border-b border-border dark:border-border-dark md:block">
        <div className="min-w-0 flex-1 [&>div]:border-b-0">
          <AssetTypeTabs
            activeType={activeType}
            onTypeChange={(type) => {
              setActiveType(type);
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
        </div>
        {apiKey && (
          <AutoRefreshIndicator
            className="shrink-0 px-2 md:absolute md:right-3 md:top-1/2 md:-translate-y-1/2 md:px-0 z-10"
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
          <DownloadsUploaders apiKey={apiKey} activeType={activeType} permissions={permissions} />

          {/* Speed Chart - Collapsible by default */}
          <SpeedChart />

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
            <DownloadsActionsProvider value={downloadActions}>
              {downloadsTableContent}
            </DownloadsActionsProvider>
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
                previewItems={viewItems}
                onViewCreated={handleViewCreated}
                onViewUpdated={handleViewUpdated}
                sortField={sortField}
                sortDirection={sortDirection}
                activeColumns={activeColumns}
                search={search}
              />
              <TagManager
                isOpen={tagManagerOpen}
                onClose={() => setTagManagerOpen(false)}
                apiKey={apiKey}
              />
            </>
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

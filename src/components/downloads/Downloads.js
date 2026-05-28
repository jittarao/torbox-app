'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useColumnManager } from '../shared/hooks/useColumnManager';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useDownloadsEnrichment } from '../shared/hooks/useDownloadsEnrichment';
import { useDownloadsHistoryMigration } from '../shared/hooks/useDownloadsHistoryMigration';
import { useDownloadsPlayers } from '../shared/hooks/useDownloadsPlayers';
import { useDownloadsFilters } from '../shared/hooks/useDownloadsFilters';
import { DownloadsActionsProvider } from './DownloadsActionsContext';
import { useDelete } from '../shared/hooks/useDelete';
import { useFetchData } from '../shared/hooks/useFetchData';
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
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import { formatSize } from './utils/formatters';
import { findItemBySelectionId } from '@/utils/downloadSelectionId';
import { hasDownloadAccess } from '@/utils/userProfile';
import { useBackendMode } from '@/hooks/useBackendMode';
import { useSessionStore } from '@/store/sessionStore';
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
  const downloadPanelT = useTranslations('DownloadPanel');
  const fetchStatusT = useTranslations('FetchStatus');
  const setPauseReason = usePollingPauseStore((state) => state.setPauseReason);
  const isPollingPaused = usePollingPauseStore((state) => state.isPollingPaused);
  const pollingPaused = usePollingPauseStore((state) =>
    Object.values(state.pauseReasons).some((isPaused) => isPaused === true)
  );
  const [toast, setToast] = useState(null);
  const [activeType, setActiveType] = useState(getStoredAssetType);
  const permissions = useSessionStore((state) => state.permissions);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState(false);

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
    fetchItems,
    dismissError,
    lastSuccessfulFetchAt,
    refreshBlockedReason,
    pollSchedule,
    canManualRefresh,
  } = useFetchData(apiKey, activeType);

  const showFullPageSpinner = loading && items.length === 0;
  const isRefreshing = loading && items.length > 0;

  const { enrichedDownloads, downloadHistory, downloadHistoryLookup, tags, updateTagName } =
    useDownloadsEnrichment(items, apiKey, isBackendAvailable);

  const { fetchDownloadHistory } = useDownloadsHistoryMigration(
    apiKey,
    isBackendAvailable,
    backendIsLoading
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
    setSelectedItems,
  } = useSelection(enrichedDownloads, activeType);

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
  const { sortField, sortDirection, handleSort, setSort, sortTorrents } = useSort();

  const {
    columnFilters,
    appliedFilters,
    filterModalOpen,
    filterModalMode,
    editingView,
    tagManagerOpen,
    setTagManagerOpen,
    tagManagerAutoCreate,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filteredItems,
    views,
    activeView,
    activeTagIds,
    handleApplyView,
    handleClearFilters,
    handleClearView,
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
    handleNewTag,
    handleManageTags,
    handleApplyFiltersFromModal,
    handlePreviewFiltersFromModal,
  } = useDownloadsFilters({
    enrichedDownloads,
    apiKey,
    isBackendAvailable,
    activeType,
    setSort,
    sortField,
    sortDirection,
    setToast,
    handleColumnChange,
    updateTagName,
  });

  const {
    videoPlayerState,
    setVideoPlayerState,
    audioPlayerState,
    setAudioPlayerState,
    handleAudioPlay,
    handleAudioRefreshUrl,
    openVideoPlayer,
  } = useDownloadsPlayers({
    apiKey,
    activeType,
    enrichedDownloads,
    requestDownloadLink,
    setToast,
  });

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
        selectedItemIds.map(async (selectionId) => {
          const item = findItemBySelectionId(enrichedDownloads, selectionId);
          if (!item) return;

          try {
            const response = await fetch(
              `/api/torrents/export?torrent_id=${item.id}&type=torrent`,
              {
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
              console.error(`Failed to export torrent ${selectionId}`);
            }
          } catch (error) {
            console.error(`Error exporting torrent ${selectionId}:`, error);
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

  const showDesktopFiltersSidebar = isBackendAvailable && !isMobile && !isFullscreen;
  const filtersSidebarExpanded = showDesktopFiltersSidebar && !filtersSidebarCollapsed;
  const filtersSidebarWidth = filtersSidebarCollapsed
    ? FILTERS_SIDEBAR_COLLAPSED
    : FILTERS_SIDEBAR_EXPANDED;

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
          selectedItems={selectedItems}
          handleSelectAll={handleSelectAll}
          handleFileSelect={handleFileSelect}
          setSelectedItems={setSelectedItems}
          downloadHistoryLookup={downloadHistoryLookup}
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
          onOpenVideoPlayer={openVideoPlayer}
          onAudioPlay={handleAudioPlay}
          fileSearch={search}
        />
      ) : (
        <CardList
          items={sortedItems}
          fileSearch={search}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          apiKey={apiKey}
          activeColumns={activeColumns}
          onFileSelect={handleFileSelect}
          downloadHistoryLookup={downloadHistoryLookup}
          onDelete={deleteItem}
          expandedItems={expandedItems}
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

      {/* Asset Type Tabs + auto-refresh countdown */}
      <div className="relative [&_nav]:pr-11 md:[&_nav]:pr-0">
        <AssetTypeTabs
          activeType={activeType}
          onTypeChange={(type) => {
            setActiveType(type);
            localStorage.setItem(ASSET_TYPE_STORAGE_KEY, type);
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

'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  useDownloadsPageState,
  FILTERS_SIDEBAR_COLLAPSED,
  FILTERS_SIDEBAR_EXPANDED,
} from '../shared/hooks/useDownloadsPageState';

import DownloadsHeader from './DownloadsHeader';
import DownloadsInfoPanel from './DownloadsInfoPanel';
import DownloadsContentArea from './DownloadsContentArea';
import { DownloadsDataProvider } from './DownloadsDataContext';
import { DownloadsFilterProvider } from './DownloadsFilterContext';
import { DownloadsUIProvider } from './DownloadsUIContext';
import { DownloadsProvider } from './DownloadsContext';
import { DownloadsActionsProvider } from './DownloadsActionsContext';
import DownloadsModals from './DownloadsModals';
import DownloadsPlayersHost from './DownloadsPlayersHost';
import FiltersSidebar from './FiltersSidebar';
import Toast from '@/components/shared/Toast';
import Spinner from '../shared/Spinner';

export default function Downloads({ apiKey, onApiKeyChange }) {
  const fetchStatusT = useTranslations('FetchStatus');
  const downloadsFiltersT = useTranslations('DownloadsFilters');

  const {
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
    isRefreshing,
    fetchError,
    fetchItems,
    dismissError,
    lastSuccessfulFetchAt,
    refreshBlockedReason,
    pollSchedule,
    canManualRefresh,
    viewItems,
    showFullPageSpinner,
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
  } = useDownloadsPageState(apiKey);

  const isTypeAvailable = useCallback(
    (type) => {
      if (type === 'all') return true;
      if (type === 'usenet') return canUseUsenet;
      return true;
    },
    [canUseUsenet]
  );

  const filtersSidebarWidth = filtersSidebarCollapsed
    ? FILTERS_SIDEBAR_COLLAPSED
    : FILTERS_SIDEBAR_EXPANDED;

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
        isTypeAvailable={isTypeAvailable}
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
              downloadLinks.length > 0 ? 'pb-[var(--download-panel-peek-height,0px)]' : ''
            }`}
          >
            <DownloadsActionsProvider value={downloadActions}>
              <DownloadsDataProvider value={downloadsDataContextValue}>
                <DownloadsFilterProvider value={downloadsFilterContextValue}>
                  <DownloadsUIProvider value={downloadsUIContextValue}>
                    <DownloadsProvider value={downloadsContextValue}>
                      <DownloadsContentArea />
                    </DownloadsProvider>
                  </DownloadsUIProvider>
                </DownloadsFilterProvider>
              </DownloadsDataProvider>
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

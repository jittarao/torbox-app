'use client';

import { useDownloadsContext } from './DownloadsContext';
import ActiveFiltersBar from './ActiveFiltersBar';
import ActionBar from './ActionBar/index';
import ItemsTable from './ItemsTable';
import CardList from './CardList';

export default function DownloadsContentArea() {
  const ctx = useDownloadsContext();

  return (
    <>
      {ctx.isBackendAvailable && (
        <ActiveFiltersBar
          appliedFilters={ctx.appliedFilters}
          activeView={ctx.activeView}
          tags={ctx.tags}
          onClear={ctx.handleClearFilters}
          onEdit={ctx.handleOpenNewFilter}
        />
      )}
      <ActionBar
        unfilteredItems={ctx.viewItems}
        filteredItems={ctx.sortedItems}
        activeColumns={ctx.activeColumns}
        onColumnChange={ctx.handleColumnChange}
        search={ctx.search}
        setSearch={ctx.setSearch}
        statusFilter={ctx.statusFilter}
        onStatusChange={ctx.setStatusFilter}
        isDownloading={ctx.isDownloading}
        onBulkDownload={() => ctx.handleBulkDownload(ctx.selectedItems, ctx.viewItems)}
        isDeleting={ctx.isDeleting}
        onBulkDelete={(includeParentDownloads) =>
          ctx.deleteItems(ctx.selectedItems, includeParentDownloads, ctx.viewItems)
        }
        isExporting={ctx.isExporting}
        onBulkExport={ctx.handleBulkExport}
        activeType={ctx.activeType}
        isBlurred={ctx.isBlurred}
        onBlurToggle={() => ctx.setIsBlurred(!ctx.isBlurred)}
        isFullscreen={ctx.isFullscreen}
        onFullscreenToggle={ctx.onFullscreenToggle}
        viewMode={ctx.displayViewMode}
        onViewModeChange={ctx.setViewMode}
        sortField={ctx.sortField}
        sortDir={ctx.sortDirection}
        handleSort={ctx.handleSort}
        getTotalDownloadSize={ctx.getTotalDownloadSize}
        isDownloadPanelOpen={ctx.isDownloadPanelOpen}
        setIsDownloadPanelOpen={ctx.setIsDownloadPanelOpen}
        apiKey={ctx.apiKey}
        setToast={ctx.setToast}
        expandAllFiles={ctx.expandAllFiles}
        collapseAllFiles={ctx.collapseAllFiles}
        scrollContainerRef={ctx.scrollContainerRef}
        hasFiltersSidebar={ctx.filtersSidebarExpanded}
      />

      {ctx.displayViewMode === 'table' ? <ItemsTable /> : <CardList />}
    </>
  );
}

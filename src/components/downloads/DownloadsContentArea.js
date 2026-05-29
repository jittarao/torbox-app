'use client';

import ActiveFiltersBar from './ActiveFiltersBar';
import ActionBar from './ActionBar/index';
import ItemsTable from './ItemsTable';
import CardList from './CardList';

export default function DownloadsContentArea({
  isBackendAvailable,
  appliedFilters,
  activeView,
  tags,
  handleClearFilters,
  handleOpenNewFilter,
  viewItems,
  sortedItems,
  visibleIds,
  activeColumns,
  handleColumnChange,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
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
  sortField,
  sortDirection,
  handleSort,
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
  onOpenVideoPlayer,
  onAudioPlay,
  fileSearch,
}) {
  return (
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
          onOpenVideoPlayer={onOpenVideoPlayer}
          onAudioPlay={onAudioPlay}
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
          onOpenVideoPlayer={onOpenVideoPlayer}
          onAudioPlay={onAudioPlay}
        />
      )}
    </>
  );
}

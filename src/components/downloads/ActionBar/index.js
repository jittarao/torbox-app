'use client';

import { useState, useRef, useEffect } from 'react';
import ColumnManager from '../ColumnManager';
import { COLUMNS } from '@/components/constants';
import { getItemTypeName } from './utils/statusHelpers';
import StatusSection from './components/StatusSection';
import SearchBar from './components/SearchBar';
import ActionButtons from './components/ActionButtons';
import ViewControls from './components/ViewControls';
import { useStatusCounts } from './hooks/useStatusCounts';
import Dropdown from '@/components/shared/Dropdown';
import { useTranslations } from 'next-intl';
import useIsMobile from '@/hooks/useIsMobile';

export default function ActionBar({
  unfilteredItems,
  selectedItems,
  setSelectedItems,
  hasSelectedFiles,
  activeColumns,
  onColumnChange,
  search,
  setSearch,
  statusFilter,
  onStatusChange,
  isDownloading,
  isDeleting,
  isExporting,
  onBulkDownload,
  onBulkDelete,
  onBulkExport,
  activeType = 'torrents',
  isBlurred = false,
  onBlurToggle,
  isFullscreen = false,
  onFullscreenToggle,
  viewMode = 'table',
  onViewModeChange,
  sortField,
  sortDir,
  handleSort,
  getTotalDownloadSize,
  isDownloadPanelOpen,
  setIsDownloadPanelOpen,
  apiKey,
  setToast,
  expandAllFiles,
  collapseAllFiles,
  expandedItems,
}) {
  const isMobile = useIsMobile();
  const [isSticky, setIsSticky] = useState(false);
  const stickyRef = useRef(null);

  const { statusCounts, statusOptions, isStatusSelected } =
    useStatusCounts(unfilteredItems);

  const t = useTranslations('Columns');

  useEffect(() => {
    const element = stickyRef.current;
    const observer = new IntersectionObserver(
      ([e]) => setIsSticky(!e.isIntersecting),
      { threshold: [1], rootMargin: '-1px 0px 0px 0px' },
    );

    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
      observer.disconnect();
    };
  }, []);

  const itemTypeName = getItemTypeName(activeType);
  const itemTypePlural = `${itemTypeName}s`;

  const sortOptions = activeColumns.map((column) => ({
    label: COLUMNS[column].displayName ? COLUMNS[column].displayName : t(`${COLUMNS[column].key}`),
    value: column,
  }));

  return (
    <div
      ref={stickyRef}
      className={`flex flex-col lg:flex-row gap-4 py-4 justify-between bg-surface dark:bg-surface-dark
        ${isSticky ? 'border-b border-border dark:border-border-dark' : ''} ${isFullscreen ? 'px-4' : ''}`}
    >
      <div className="flex gap-4 items-center flex-wrap min-h-[49px]">
        <StatusSection
          statusCounts={statusCounts}
          statusOptions={statusOptions}
          isStatusSelected={isStatusSelected}
          unfilteredItems={unfilteredItems}
          selectedItems={selectedItems}
          hasSelectedFiles={hasSelectedFiles}
          statusFilter={statusFilter}
          onStatusChange={onStatusChange}
          itemTypeName={itemTypeName}
          itemTypePlural={itemTypePlural}
          getTotalDownloadSize={getTotalDownloadSize}
        />

        {(selectedItems.items?.size > 0 || hasSelectedFiles()) && (
          <ActionButtons
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            hasSelectedFiles={hasSelectedFiles}
            isDownloading={isDownloading}
            isDeleting={isDeleting}
            isExporting={isExporting}
            onBulkDownload={onBulkDownload}
            onBulkDelete={onBulkDelete}
            onBulkExport={onBulkExport}
            itemTypeName={itemTypeName}
            itemTypePlural={itemTypePlural}
            isDownloadPanelOpen={isDownloadPanelOpen}
            setIsDownloadPanelOpen={setIsDownloadPanelOpen}
            activeType={activeType}
            apiKey={apiKey}
            setToast={setToast}
          />
        )}
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        {/* Search bar */}
        <SearchBar
          search={search}
          onSearchChange={setSearch}
          itemTypePlural={itemTypePlural}
        />

        {/* Filter by status */}
        {/* <StatusFilterDropdown
          options={statusOptions}
          value={statusFilter}
          onChange={(value) => onStatusChange(value)}
          className="min-w-[150px]"
        /> */}

        {/* Sort downloads list */}
        {viewMode === 'card' || (isMobile && viewMode === 'table') && (
          <div className="flex items-center gap-1">
            <Dropdown
              options={sortOptions}
              value={sortField}
              onChange={(value) => handleSort(value)}
              className="min-w-[150px]"
              sortDir={sortDir}
            />
            <button
              onClick={() => handleSort(sortField)}
              className="px-1 py-2 text-primary-text/70 dark:text-primary-text-dark/70 hover:text-accent dark:hover:text-accent-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark rounded-lg transition-colors shrink-0"
            >
              {sortDir === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        )}

        {/* View controls such as blur, fullscreen, and view mode */}
        <ViewControls
          isBlurred={isBlurred}
          onBlurToggle={onBlurToggle}
          isFullscreen={isFullscreen}
          onFullscreenToggle={onFullscreenToggle}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          expandAllFiles={expandAllFiles}
          collapseAllFiles={collapseAllFiles}
          expandedItems={expandedItems}
          unfilteredItems={unfilteredItems}
        />

        {/* Column manager */}
        <div className="hidden lg:block">
          <ColumnManager
            columns={COLUMNS}
            activeColumns={activeColumns}
            onColumnChange={onColumnChange}
            activeType={activeType}
          />
        </div>
      </div>
    </div>
  );
}

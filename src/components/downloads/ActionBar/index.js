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
  onBulkDownload,
  onBulkDelete,
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
}) {
  const [isSticky, setIsSticky] = useState(false);
  const stickyRef = useRef(null);

  const { statusCounts, statusOptions, isStatusSelected } =
    useStatusCounts(unfilteredItems);

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
    label: COLUMNS[column].label,
    value: column,
  }));

  return (
    <div
      ref={stickyRef}
      className={`flex flex-col lg:flex-row gap-4 py-4 justify-between bg-surface dark:bg-surface-dark
        ${isSticky ? 'border-b border-border dark:border-border-dark' : ''} ${isFullscreen ? 'px-4' : ''}`}
    >
      <div className="flex gap-4 items-center flex-wrap min-h-[53px]">
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
            onBulkDownload={onBulkDownload}
            onBulkDelete={onBulkDelete}
            itemTypeName={itemTypeName}
            itemTypePlural={itemTypePlural}
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
        {viewMode === 'card' && (
          <Dropdown
            options={sortOptions}
            value={sortField}
            onChange={(value) => handleSort(value)}
            className="min-w-[150px]"
            sortDir={sortDir}
          />
        )}

        {/* View controls such as blur, fullscreen, and view mode */}
        <ViewControls
          isBlurred={isBlurred}
          onBlurToggle={onBlurToggle}
          isFullscreen={isFullscreen}
          onFullscreenToggle={onFullscreenToggle}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
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

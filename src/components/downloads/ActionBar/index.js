'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
import ColumnManager from '../ColumnManager';
import { COLUMNS } from '@/components/constants';
import { getItemTypeName } from './utils/statusHelpers';
import StatusSection from './components/StatusSection';
import SearchBar from './components/SearchBar';
import ActionButtons from './components/ActionButtons';
import ViewControls from './components/ViewControls';
import { useDownloadsStatusCounts } from './hooks/useDownloadsStatusCounts';
import Dropdown from '@/components/shared/Dropdown';
import { useTranslations } from 'next-intl';
import useIsMobile from '@/hooks/useIsMobile';
import {
  useDownloadsSelectionStore,
  selectHasSelectedFiles,
  selectSelectedItemCount,
  selectTotalSelectedFileCount,
} from '@/store/downloadsSelectionStore';
import { useLayoutOnTabVisible } from '../hooks/useLayoutOnTabVisible';
import { useDownloadsDataContext } from '@/components/downloads/DownloadsDataContext';
import { useDownloadsFilterContext } from '@/components/downloads/DownloadsFilterContext';
import { useDownloadsUIContext } from '@/components/downloads/DownloadsUIContext';
import { useDownloadsContext } from '@/components/downloads/DownloadsContext';

export default function ActionBar() {
  const {
    viewItems: unfilteredItems,
    sortedItems: filteredItems,
    activeColumns,
  } = useDownloadsDataContext();
  const {
    handleColumnChange: onColumnChange,
    search,
    setSearch,
    statusFilter,
    setStatusFilter: onStatusChange,
    sortField,
    sortDirection: sortDir,
    handleSort,
  } = useDownloadsFilterContext();
  const {
    activeType = 'torrents',
    isBlurred = false,
    setIsBlurred,
    isFullscreen = false,
    onFullscreenToggle,
    displayViewMode: viewMode = 'table',
    setViewMode: onViewModeChange,
    isDownloadPanelOpen,
    setIsDownloadPanelOpen,
    scrollContainerRef,
    expandAllFiles,
    collapseAllFiles,
    filtersSidebarExpanded: hasFiltersSidebar = false,
  } = useDownloadsUIContext();
  const {
    isDownloading,
    isDeleting,
    isExporting,
    handleBulkDownload: onBulkDownload,
    deleteItems: onBulkDelete,
    handleBulkExport: onBulkExport,
    getTotalDownloadSize,
    apiKey,
    setToast,
  } = useDownloadsContext();
  const onBlurToggle = () => setIsBlurred(!isBlurred);
  const onBulkDownloadWrapper = () =>
    onBulkDownload(useDownloadsSelectionStore.getState().selectedItems, unfilteredItems);
  const onBulkDeleteWrapper = (includeParentDownloads) =>
    onBulkDelete(
      useDownloadsSelectionStore.getState().selectedItems,
      includeParentDownloads,
      unfilteredItems
    );
  const selectedItemCount = useDownloadsSelectionStore(selectSelectedItemCount);
  const selectedFileCount = useDownloadsSelectionStore(selectTotalSelectedFileCount);
  const hasSelectedFiles = useDownloadsSelectionStore(selectHasSelectedFiles);
  const setSelectedItems = useDownloadsSelectionStore((state) => state.setSelectedItems);
  const hasSelection = selectedItemCount > 0 || hasSelectedFiles;
  const isMobile = useIsMobile();
  const [isSticky, setIsSticky] = useState(false);
  const [spacerHeight, setSpacerHeight] = useState(0);
  /** Viewport-aligned left/width when sticky (matches scroll column, incl. filter sidebar offset) */
  const [stickyBounds, setStickyBounds] = useState(null);
  const stickyRef = useRef(null);
  const isStickyRef = useRef(false);
  const refreshStickyLayoutRef = useRef(() => {});

  const { statusCounts, statusOptions, isStatusSelected } = useDownloadsStatusCounts(activeType);

  const t = useTranslations('Columns');

  // Sticky detection via IntersectionObserver sentinel
  useEffect(() => {
    const element = stickyRef.current;
    if (!element) return;

    // Reset sticky state when mode changes
    setIsSticky(false);
    isStickyRef.current = false;

    const measureHeight = () => {
      if (element) {
        const height = element.offsetHeight;
        setSpacerHeight((prev) => (prev !== height ? height : prev));
      }
    };

    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(measureHeight, 100);
    };

    const updateBounds = () => {
      const column = scrollContainerRef?.current;
      if (!column || !isStickyRef.current || isFullscreen) {
        setStickyBounds(null);
        return;
      }
      const rect = column.getBoundingClientRect();
      setStickyBounds({ left: rect.left, width: rect.width });
    };

    const parent = element.parentElement;
    if (!parent) return;

    // Create sentinel element
    const sentinel = document.createElement('div');
    sentinel.style.position = 'absolute';
    sentinel.style.top = '0';
    sentinel.style.width = '1px';
    sentinel.style.height = '1px';
    sentinel.style.pointerEvents = 'none';
    parent.insertBefore(sentinel, element);

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldBeSticky = !entry.isIntersecting;
        if (shouldBeSticky !== isStickyRef.current) {
          isStickyRef.current = shouldBeSticky;
          setIsSticky(shouldBeSticky);
          if (shouldBeSticky) {
            measureHeight();
          }
        }
        if (shouldBeSticky && !isFullscreen) {
          updateBounds();
        }
      },
      { threshold: [0], rootMargin: '-1px 0px 0px 0px' }
    );
    observer.observe(sentinel);

    refreshStickyLayoutRef.current = () => {
      measureHeight();
      updateBounds();
      observer.unobserve(sentinel);
      observer.observe(sentinel);
    };

    // Initial setup
    measureHeight();
    window.addEventListener('resize', handleResize);

    const column = scrollContainerRef?.current;
    const resizeObserver =
      column && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateBounds())
        : null;
    resizeObserver?.observe(column);

    return () => {
      observer.disconnect();
      refreshStickyLayoutRef.current = () => {};
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
      sentinel.remove();
    };
  }, [isFullscreen, scrollContainerRef, viewMode]);

  useLayoutOnTabVisible(() => {
    if (!stickyRef.current) return;
    refreshStickyLayoutRef.current();
  });

  const itemTypeName = getItemTypeName(activeType);
  const itemTypePlural = `${itemTypeName}s`;

  const sortOptions = activeColumns.map((column) => ({
    label: COLUMNS[column].displayName ? COLUMNS[column].displayName : t(`${COLUMNS[column].key}`),
    value: column,
  }));

  return (
    <Fragment>
      {/* Spacer to prevent layout shift when ActionBar becomes fixed */}
      {isSticky && spacerHeight > 0 && <div style={{ height: `${spacerHeight}px` }} />}
      <div
        ref={stickyRef}
        className={
          isSticky
            ? `fixed top-0 z-50 border-b border-border dark:border-border-dark shadow-lg bg-surface dark:bg-surface-dark ${
                isFullscreen
                  ? 'left-0 right-0'
                  : stickyBounds
                    ? ''
                    : hasFiltersSidebar
                      ? 'left-0 right-0 md:left-[var(--downloads-content-left)]'
                      : 'left-0 right-0 md:left-[var(--sidebar-width,0px)]'
              }`
            : undefined
        }
        style={
          isSticky && !isFullscreen && stickyBounds
            ? { left: stickyBounds.left, width: stickyBounds.width, right: 'auto' }
            : undefined
        }
      >
        <div
          className={`flex flex-col gap-y-2 transition-all duration-200 xl:flex-row xl:flex-wrap xl:items-center xl:gap-x-3 xl:gap-y-2
            ${isFullscreen ? 'px-2 sm:px-4' : isSticky ? (stickyBounds ? 'px-0' : 'container-downloads mx-auto px-2 sm:px-4') : ''}
            ${isSticky ? 'py-2' : 'pb-4'}`}
        >
          {/* Status + bulk actions — stacked below xl (incl. iPad landscape) */}
          <div className="flex min-w-0 w-full flex-col gap-2 sm:gap-2 xl:w-auto xl:flex-1 xl:flex-row xl:flex-wrap xl:items-center xl:gap-3">
            <StatusSection
              statusCounts={statusCounts}
              statusOptions={statusOptions}
              isStatusSelected={isStatusSelected}
              unfilteredItems={unfilteredItems}
              filteredItems={filteredItems}
              selectedItemCount={selectedItemCount}
              selectedFileCount={selectedFileCount}
              hasSelectedFiles={hasSelectedFiles}
              statusFilter={statusFilter}
              onStatusChange={onStatusChange}
              itemTypeName={itemTypeName}
              itemTypePlural={itemTypePlural}
              getTotalDownloadSize={getTotalDownloadSize}
            />

            {hasSelection && (
              <ActionButtons
                setSelectedItems={setSelectedItems}
                hasSelectedFiles={hasSelectedFiles}
                isDownloading={isDownloading}
                isDeleting={isDeleting}
                isExporting={isExporting}
                onBulkDownload={onBulkDownloadWrapper}
                onBulkDelete={onBulkDeleteWrapper}
                onBulkExport={onBulkExport}
                itemTypeName={itemTypeName}
                itemTypePlural={itemTypePlural}
                isDownloadPanelOpen={isDownloadPanelOpen}
                setIsDownloadPanelOpen={setIsDownloadPanelOpen}
                activeType={activeType}
                apiKey={apiKey}
                setToast={setToast}
                allItems={unfilteredItems}
              />
            )}
          </div>

          {/* Search, sort, view controls — own row below xl */}
          <div className="flex min-w-0 w-full flex-wrap items-center gap-2 xl:ml-auto xl:w-auto xl:shrink-0 xl:justify-end">
            <SearchBar
              search={search}
              onSearchChange={setSearch}
              itemTypePlural={itemTypePlural}
              className="min-w-0 w-full basis-full sm:basis-auto sm:w-44 sm:flex-none md:w-52 lg:w-60"
            />

            {viewMode === 'card' && (
              <div className="flex shrink-0 items-center gap-1">
                <Dropdown
                  options={sortOptions}
                  value={sortField}
                  onChange={(value) => handleSort(value)}
                  className="min-w-[8.5rem] max-w-[11rem] sm:min-w-[150px]"
                  sortDir={sortDir}
                />
                <button
                  type="button"
                  onClick={() => handleSort(sortField)}
                  className="shrink-0 rounded-md border border-border px-2 py-1.5 text-sm text-primary-text/70 transition-colors hover:bg-surface-alt-hover hover:text-accent dark:border-border-dark dark:text-primary-text-dark/70 dark:hover:bg-surface-alt-hover-dark dark:hover:text-accent-dark"
                  aria-label={sortDir === 'desc' ? 'Sort descending' : 'Sort ascending'}
                >
                  {sortDir === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            )}

            <ViewControls
              isMobile={isMobile}
              isBlurred={isBlurred}
              onBlurToggle={onBlurToggle}
              isFullscreen={isFullscreen}
              onFullscreenToggle={onFullscreenToggle}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              expandAllFiles={expandAllFiles}
              collapseAllFiles={collapseAllFiles}
              unfilteredItems={unfilteredItems}
            />

            <div className="hidden shrink-0 lg:block">
              <ColumnManager
                columns={COLUMNS}
                activeColumns={activeColumns}
                onColumnChange={onColumnChange}
                activeType={activeType}
              />
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}

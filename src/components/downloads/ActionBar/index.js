'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
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
  filteredItems,
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
  scrollContainerRef,
}) {
  const isMobile = useIsMobile();
  const [isSticky, setIsSticky] = useState(false);
  const [spacerHeight, setSpacerHeight] = useState(0);
  const stickyRef = useRef(null);
  const isStickyRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const initialTopRef = useRef(0);

  // Use filteredItems for status counts if available, otherwise use unfilteredItems
  const itemsForStatusCounts = filteredItems || unfilteredItems;
  const { statusCounts, statusOptions, isStatusSelected } =
    useStatusCounts(itemsForStatusCounts);

  const t = useTranslations('Columns');

  // Reset sticky state when switching modes (fullscreen, view mode, etc.)
  useEffect(() => {
    // Reset sticky state when mode changes
    setIsSticky(false);
    isStickyRef.current = false;
    
    // Recalculate initial position after a brief delay to allow DOM to settle
    const timer = setTimeout(() => {
      const element = stickyRef.current;
      if (element) {
        const rect = element.getBoundingClientRect();
        const scrollTop = isFullscreen && scrollContainerRef?.current
          ? scrollContainerRef.current.scrollTop
          : window.scrollY || document.documentElement.scrollTop;
        initialTopRef.current = rect.top + scrollTop;
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isFullscreen, scrollContainerRef, viewMode]);

  // Measure height
  useEffect(() => {
    const element = stickyRef.current;
    if (!element) return;

    const measureHeight = () => {
      if (element) {
        const height = element.offsetHeight;
        setSpacerHeight((prev) => (prev !== height ? height : prev));
      }
    };

    // Measure initially
    measureHeight();

    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(measureHeight, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Scroll-based sticky detection - compare scroll position to initial position
  useEffect(() => {
    const element = stickyRef.current;
    if (!element) return;

    // Recalculate initial position when effect runs (mode changed)
    const recalculateInitialTop = () => {
      if (element) {
        const rect = element.getBoundingClientRect();
        const scrollTop = isFullscreen && scrollContainerRef?.current
          ? scrollContainerRef.current.scrollTop
          : window.scrollY || document.documentElement.scrollTop;
        initialTopRef.current = rect.top + scrollTop;
      }
    };

    // Recalculate after a brief delay to ensure DOM is ready
    const initTimer = setTimeout(recalculateInitialTop, 100);

    const checkSticky = () => {
      if (!element) return;

      const scrollTop = isFullscreen && scrollContainerRef?.current
        ? scrollContainerRef.current.scrollTop
        : window.scrollY || document.documentElement.scrollTop;

      // ActionBar should be sticky when we've scrolled past its initial position
      // We use >= instead of > to account for the exact moment it reaches the top
      const shouldBeSticky = scrollTop >= initialTopRef.current;

      // Only update if state actually changed
      if (shouldBeSticky !== isStickyRef.current) {
        isStickyRef.current = shouldBeSticky;
        setIsSticky(shouldBeSticky);

        // Measure height when becoming sticky
        if (shouldBeSticky) {
          const height = element.offsetHeight;
          setSpacerHeight((prev) => (prev !== height ? height : prev));
        } else {
          // When becoming unsticky, update initial position in case layout changed
          requestAnimationFrame(() => {
            if (element && !isStickyRef.current) {
              recalculateInitialTop();
            }
          });
        }
      }
    };

    // Throttled scroll handler
    const handleScroll = () => {
      if (scrollTimeoutRef.current) {
        return;
      }

      scrollTimeoutRef.current = requestAnimationFrame(() => {
        checkSticky();
        scrollTimeoutRef.current = null;
      });
    };

    // Initial check after initial position is calculated
    const checkTimer = setTimeout(() => {
      checkSticky();
    }, 150);

    // Attach scroll listener to appropriate element
    const scrollElement = isFullscreen && scrollContainerRef?.current
      ? scrollContainerRef.current
      : window;

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(initTimer);
      clearTimeout(checkTimer);
      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [isFullscreen, scrollContainerRef]);

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
        className={`flex flex-col lg:flex-row gap-4 justify-between bg-surface dark:bg-surface-dark
          ${isSticky ? 'fixed top-0 left-0 right-0 z-50 py-2 border-b border-border dark:border-border-dark shadow-lg' : 'py-4'} 
          ${isFullscreen ? 'px-4' : isSticky ? 'px-4' : ''}
          transition-all duration-200`}
      >
      <div className="flex gap-4 items-center flex-wrap min-h-[49px]">
        <StatusSection
          statusCounts={statusCounts}
          statusOptions={statusOptions}
          isStatusSelected={isStatusSelected}
          unfilteredItems={unfilteredItems}
          filteredItems={filteredItems}
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
          isMobile={isMobile}
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
    </Fragment>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
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
  hasFiltersSidebar = false,
}) {
  const isMobile = useIsMobile();
  const [isSticky, setIsSticky] = useState(false);
  const [spacerHeight, setSpacerHeight] = useState(0);
  /** Viewport-aligned left/width when sticky (matches scroll column, incl. filter sidebar offset) */
  const [stickyBounds, setStickyBounds] = useState(null);
  const stickyRef = useRef(null);
  const isStickyRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const initialTopRef = useRef(0);

  // Use filteredItems for status counts if available, otherwise use unfilteredItems
  const itemsForStatusCounts = filteredItems || unfilteredItems;
  const { statusCounts, statusOptions, isStatusSelected } = useStatusCounts(itemsForStatusCounts);

  const t = useTranslations('Columns');

  const updateStickyBounds = useCallback(() => {
    const column = scrollContainerRef?.current;
    if (!column) {
      setStickyBounds(null);
      return;
    }
    const rect = column.getBoundingClientRect();
    setStickyBounds({ left: rect.left, width: rect.width });
  }, [scrollContainerRef]);

  // Keep fixed ActionBar aligned with the downloads table column (nav + filter sidebars)
  useEffect(() => {
    if (!isSticky || isFullscreen) {
      setStickyBounds(null);
      return;
    }

    updateStickyBounds();

    window.addEventListener('resize', updateStickyBounds);

    const column = scrollContainerRef?.current;
    const resizeObserver =
      column && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateStickyBounds())
        : null;
    resizeObserver?.observe(column);

    // App nav sidebar width animates ~300ms
    const transitionTimer = setTimeout(updateStickyBounds, 320);

    return () => {
      window.removeEventListener('resize', updateStickyBounds);
      resizeObserver?.disconnect();
      clearTimeout(transitionTimer);
    };
  }, [isSticky, isFullscreen, scrollContainerRef, updateStickyBounds]);

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
        const scrollTop =
          isFullscreen && scrollContainerRef?.current
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
        const scrollTop =
          isFullscreen && scrollContainerRef?.current
            ? scrollContainerRef.current.scrollTop
            : window.scrollY || document.documentElement.scrollTop;
        initialTopRef.current = rect.top + scrollTop;
      }
    };

    // Recalculate after a brief delay to ensure DOM is ready
    const initTimer = setTimeout(recalculateInitialTop, 100);

    const checkSticky = () => {
      if (!element) return;

      const scrollTop =
        isFullscreen && scrollContainerRef?.current
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
        if (isStickyRef.current && !isFullscreen) {
          updateStickyBounds();
        }
        scrollTimeoutRef.current = null;
      });
    };

    // Initial check after initial position is calculated
    const checkTimer = setTimeout(() => {
      checkSticky();
    }, 150);

    // Attach scroll listener to appropriate element
    const scrollElement =
      isFullscreen && scrollContainerRef?.current ? scrollContainerRef.current : window;

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearTimeout(initTimer);
      clearTimeout(checkTimer);
      if (scrollTimeoutRef.current) {
        cancelAnimationFrame(scrollTimeoutRef.current);
      }
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [isFullscreen, scrollContainerRef, updateStickyBounds]);

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
          className={`flex flex-wrap items-center gap-x-3 gap-y-2 transition-all duration-200
            ${isFullscreen ? 'px-2 sm:px-4' : isSticky ? (stickyBounds ? 'px-0' : 'container-downloads mx-auto px-2 sm:px-4') : ''}
            ${isSticky ? 'py-2' : 'pb-4'}`}
        >
          {/* Left: counts, status filters, bulk actions */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
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

          {/* Right: search, sort, view controls */}
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
            <SearchBar
              search={search}
              onSearchChange={setSearch}
              itemTypePlural={itemTypePlural}
              className="w-36 sm:w-44 md:w-52 lg:w-60"
            />

            {(viewMode === 'card' || (isMobile && viewMode === 'table')) && (
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
              expandedItems={expandedItems}
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

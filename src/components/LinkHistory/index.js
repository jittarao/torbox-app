'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import useIsMobile from '@/hooks/useIsMobile';
import Spinner from '@/components/shared/Spinner';
import { useLinkHistory } from './hooks/useLinkHistory';
import { useLinkHistoryActions } from './hooks/useLinkHistoryActions';
import EmptyState from './components/EmptyState';
import SearchBar from './components/SearchBar';
import LinkHistoryTable from './components/LinkHistoryTable';
import Pagination from './components/Pagination';
import { useBackendMode } from '@/hooks/useBackendMode';
import { useShiftRangeRowSelection } from '@/hooks/useShiftRangeRowSelection';

const LinkHistory = ({ apiKey }) => {
  const t = useTranslations('Common');
  const linkHistoryT = useTranslations('LinkHistory');
  const isMobile = useIsMobile();
  const { mode: backendMode, isLoading: backendIsLoading } = useBackendMode();
  const isBackendAvailable = backendMode === 'backend';

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  // Input value (immediate updates for UI responsiveness)
  const [searchInput, setSearchInput] = useState('');
  // Debounced search value (triggers API calls)
  const [search, setSearch] = useState('');
  const [selectedLinks, setSelectedLinks] = useState(new Set());

  const { history, loading, error, fetchLinkHistory } = useLinkHistory(
    apiKey,
    pagination,
    setPagination,
    search
  );

  const {
    deleting,
    bulkDeleting,
    copySuccess,
    copiedLinkCount,
    handleDelete,
    handleBulkDelete,
    handleCopy,
    handleBulkCopy,
  } = useLinkHistoryActions(apiKey, fetchLinkHistory, setSelectedLinks);

  const getLinkRowId = useCallback((item) => item.id, []);
  const { buildSelectionUpdater } = useShiftRangeRowSelection(history, getLinkRowId);

  // Debounce search input - update search value after 500ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSelectAll = useCallback(
    (checked) => {
      if (checked) {
        setSelectedLinks(new Set(history.map((item) => item.id)));
      } else {
        setSelectedLinks(new Set());
      }
    },
    [history]
  );

  const handleSelectLink = useCallback(
    (id, checked, rowIndex, isShiftKey = false) => {
      setSelectedLinks(buildSelectionUpdater(id, checked, rowIndex, isShiftKey));
    },
    [buildSelectionUpdater]
  );

  const handlePageChange = useCallback((page) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchInput(value);
  }, []);

  const handleOpenLink = useCallback((url) => {
    window.open(url, '_blank');
  }, []);

  const handleBulkDeleteClick = useCallback(() => {
    handleBulkDelete(selectedLinks);
  }, [handleBulkDelete, selectedLinks]);

  const handleBulkCopyClick = useCallback(() => {
    const selectedItems = history.filter((item) => selectedLinks.has(item.id));
    handleBulkCopy(selectedItems);
  }, [handleBulkCopy, history, selectedLinks]);

  const selectedCopyableCount = useMemo(
    () =>
      history.filter((item) => selectedLinks.has(item.id) && item.status !== 'failed' && item.url)
        .length,
    [history, selectedLinks]
  );

  // Memoize derived values
  const allSelected = useMemo(
    () => history.length > 0 && selectedLinks.size === history.length,
    [history.length, selectedLinks.size]
  );

  const someSelected = useMemo(
    () => selectedLinks.size > 0 && selectedLinks.size < history.length,
    [selectedLinks.size, history.length]
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-md font-medium text-primary-text dark:text-primary-text-dark lg:text-xl">
          {linkHistoryT('title')}
        </h1>
        <SearchBar
          search={searchInput}
          onSearchChange={handleSearchChange}
          selectedCount={selectedLinks.size}
          selectedCopyableCount={selectedCopyableCount}
          onBulkCopy={handleBulkCopyClick}
          onBulkDelete={handleBulkDeleteClick}
          bulkDeleting={bulkDeleting}
          onRefresh={fetchLinkHistory}
        />
      </div>

      {!backendIsLoading && !isBackendAvailable && (
        <div className="p-4 bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark border border-label-warning-text/20 rounded-lg mb-4">
          Link history feature is disabled when backend is disabled.
        </div>
      )}

      {error && (
        <div className="p-4 bg-label-danger-bg dark:bg-label-danger-bg-dark text-label-danger-text dark:text-label-danger-text-dark border border-label-danger-text/20 rounded-lg mb-4">
          {error}
        </div>
      )}

      {copySuccess && (
        <div className="p-2 bg-label-success-bg dark:bg-label-success-bg-dark text-label-success-text dark:text-label-success-text-dark border border-label-success-text/20 rounded-lg text-sm mb-4">
          {copiedLinkCount > 1
            ? linkHistoryT('toast.linksCopied', { count: copiedLinkCount })
            : linkHistoryT('toast.linkCopied')}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {!loading && (
        <>
          {!backendIsLoading && !isBackendAvailable ? (
            <div className="p-8 text-center text-primary-text/70 dark:text-primary-text-dark/70">
              <p>Link history is not available when backend is disabled.</p>
            </div>
          ) : history.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <LinkHistoryTable
                history={history}
                selectedLinks={selectedLinks}
                onSelectAll={handleSelectAll}
                onSelectLink={handleSelectLink}
                onCopy={handleCopy}
                onDelete={handleDelete}
                onOpen={handleOpenLink}
                deleting={deleting}
                isMobile={isMobile}
                allSelected={allSelected}
                someSelected={someSelected}
              />

              {pagination.totalPages > 1 && (
                <Pagination pagination={pagination} onPageChange={handlePageChange} />
              )}
            </>
          )}
        </>
      )}
    </>
  );
};

export default LinkHistory;

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

const LinkHistory = ({ apiKey }) => {
  const t = useTranslations('Common');
  const linkHistoryT = useTranslations('LinkHistory');
  const isMobile = useIsMobile();

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [selectedLinks, setSelectedLinks] = useState(new Set());

  const { history, loading, error, fetchLinkHistory } = useLinkHistory(
    apiKey,
    pagination,
    setPagination,
    search
  );

  const { deleting, bulkDeleting, copySuccess, handleDelete, handleBulkDelete, handleCopy } =
    useLinkHistoryActions(apiKey, fetchLinkHistory, setSelectedLinks);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [search]);

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

  const handleSelectLink = useCallback((id, checked) => {
    setSelectedLinks((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handlePageChange = useCallback((page) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
  }, []);

  const handleOpenLink = useCallback((url) => {
    window.open(url, '_blank');
  }, []);

  const handleBulkDeleteClick = useCallback(() => {
    handleBulkDelete(selectedLinks);
  }, [handleBulkDelete, selectedLinks]);

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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-md lg:text-xl font-medium text-primary-text dark:text-primary-text-dark">
          {linkHistoryT('title')}
        </h1>
        <SearchBar
          search={search}
          onSearchChange={handleSearchChange}
          selectedCount={selectedLinks.size}
          onBulkDelete={handleBulkDeleteClick}
          bulkDeleting={bulkDeleting}
          onRefresh={fetchLinkHistory}
        />
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 text-red-500 dark:bg-red-400/20 dark:text-red-400 rounded-lg mb-4">
          {error}
        </div>
      )}

      {copySuccess && (
        <div className="p-2 bg-green-500/20 text-green-500 dark:bg-green-400/20 dark:text-green-400 rounded-lg text-sm mb-4">
          Link copied to clipboard!
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {!loading && (
        <>
          {history.length === 0 ? (
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

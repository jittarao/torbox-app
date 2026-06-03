'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, Copy, Restore, Times } from '@/components/icons';
import { useArchive } from '@/hooks/useArchive';
import { timeAgo } from '@/components/downloads/utils/formatters';
import useIsMobile from '@/hooks/useIsMobile';
import Toast from '@/components/shared/Toast';
import SearchBar from '@/components/LinkHistory/components/SearchBar';
import { useArchivedDownloadsActions } from './hooks/useArchivedDownloadsActions';

export default function ArchivedDownloads({ apiKey }) {
  const t = useTranslations('Common');
  const archivedT = useTranslations('ArchivedDownloads');
  const isMobile = useIsMobile();
  const [toast, setToast] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const selectAllRef = useRef(null);

  const {
    getArchivedDownloads,
    removeFromArchive,
    restoreFromArchive,
    loading,
    error,
    pagination: resolvedPagination,
    fetchPage,
    fetchArchivedDownloads,
  } = useArchive(apiKey, pagination, setPagination, search);

  const { bulkDeleting, handleBulkDelete, handleRemove } = useArchivedDownloadsActions(
    apiKey,
    fetchArchivedDownloads,
    setSelectedItems,
    removeFromArchive
  );

  const archivedItems = getArchivedDownloads();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSelectAll = useCallback(
    (checked) => {
      if (checked) {
        setSelectedItems(new Set(archivedItems.map((item) => item.archiveId)));
      } else {
        setSelectedItems(new Set());
      }
    },
    [archivedItems]
  );

  const handleSelectItem = useCallback((archiveId, checked) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(archiveId);
      } else {
        next.delete(archiveId);
      }
      return next;
    });
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchInput(value);
  }, []);

  const handleBulkDeleteClick = useCallback(() => {
    handleBulkDelete(selectedItems);
  }, [handleBulkDelete, selectedItems]);

  const allSelected = useMemo(
    () => archivedItems.length > 0 && selectedItems.size === archivedItems.length,
    [archivedItems.length, selectedItems.size]
  );

  const someSelected = useMemo(
    () => selectedItems.size > 0 && selectedItems.size < archivedItems.length,
    [selectedItems.size, archivedItems.length]
  );

  if (selectAllRef.current) {
    selectAllRef.current.indeterminate = someSelected;
  }

  const onRemove = async (id) => {
    await handleRemove(
      id,
      () =>
        setToast({
          message: archivedT('toast.removed') || 'Removed from archive',
          type: 'success',
        }),
      (err) => {
        console.error('Error removing from archive:', err);
        setToast({
          message: err.message || archivedT('toast.removeError') || 'Failed to remove',
          type: 'error',
        });
      }
    );
  };

  const handleRestore = async (download) => {
    try {
      await restoreFromArchive(download);
      setToast({
        message: archivedT('toast.restored') || 'Added to TorBox',
        type: 'success',
      });
    } catch (err) {
      console.error('Error restoring from archive:', err);
      setToast({
        message: err.message || archivedT('toast.restoreError') || 'Failed to restore',
        type: 'error',
      });
    }
  };

  const handleCopyMagnet = async (download) => {
    const encodedName = encodeURIComponent(download.name || 'Unknown');
    const magnetLink = `magnet:?xt=urn:btih:${download.hash}&dn=${encodedName}`;
    await navigator.clipboard.writeText(magnetLink);
    setToast({
      message: archivedT('toast.magnetCopied'),
      type: 'success',
    });
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-md font-medium text-primary-text dark:text-primary-text-dark lg:text-xl">
          {archivedT('title')}
        </h1>
        <SearchBar
          search={searchInput}
          onSearchChange={handleSearchChange}
          selectedCount={selectedItems.size}
          onBulkDelete={handleBulkDeleteClick}
          bulkDeleting={bulkDeleting}
          onRefresh={fetchArchivedDownloads}
          ariaLabel="Archived downloads actions"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-label-danger-text/20 bg-label-danger-bg p-4 text-label-danger-text dark:bg-label-danger-bg-dark dark:text-label-danger-text-dark">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-border bg-surface p-8 dark:border-border-dark dark:bg-surface-dark md:p-12">
          <div className="text-center">
            <p className="text-md text-primary-text/70 dark:text-primary-text-dark/70">
              {t('loading') || 'Loading...'}
            </p>
          </div>
        </div>
      )}

      {!loading && archivedItems.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 dark:border-border-dark dark:bg-surface-dark md:p-12">
          <div className="text-center">
            <Archive className="mx-auto mb-4 size-16 text-primary-text/40 dark:text-primary-text-dark/40" />
            <h2 className="mb-2 text-lg font-medium text-primary-text dark:text-primary-text-dark">
              {archivedT('emptyState.title')}
            </h2>
            <p className="mx-auto mb-4 max-w-2xl text-md text-primary-text/70 dark:text-primary-text-dark/70">
              {search ? archivedT('emptyState.noSearchResults') : archivedT('emptyState.description')}
            </p>
            {!search && (
              <div className="mt-6 rounded-lg border border-border bg-surface-alt p-4 dark:border-border-dark dark:bg-surface-alt-dark">
                <p className="mb-2 text-md text-primary-text/60 dark:text-primary-text-dark/60">
                  <strong className="text-primary-text dark:text-primary-text-dark">
                    {archivedT('emptyState.howItWorks')}
                  </strong>
                </p>
                <ul className="mx-auto max-w-md space-y-1 text-left text-sm text-primary-text/60 dark:text-primary-text-dark/60">
                  <li>• {archivedT('emptyState.step1')}</li>
                  <li>• {archivedT('emptyState.step2')}</li>
                  <li>• {archivedT('emptyState.step3')}</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!loading && archivedItems.length > 0 && (
        <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border dark:border-border-dark">
          <table className="relative min-w-full table-fixed divide-y divide-border dark:divide-border-dark">
            <thead className="bg-surface-alt dark:bg-surface-alt-dark">
              <tr className="table-rowbg-surface-alt dark:bg-surface-alt-dark">
                <th className="w-12 px-3 py-2 text-left text-xs font-medium uppercase text-primary-text dark:text-primary-text-dark md:px-4">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="size-4 cursor-pointer accent-accent dark:accent-accent-dark"
                    aria-label={archivedT('actions.selectItem')}
                  />
                </th>
                <th className="relative group w-[120px] min-w-[120px] max-w-[150px] cursor-pointer select-none px-2.5 py-2 text-left text-xs font-medium uppercase text-primary-text transition-colors hover:bg-surface-hover dark:text-primary-text-dark dark:hover:bg-surface-hover-dark md:px-3">
                  {archivedT('columns.itemId')}
                </th>
                <th className="relative group cursor-pointer select-none px-2.5 py-2 text-left text-xs font-medium uppercase text-primary-text transition-colors hover:bg-surface-hover dark:text-primary-text-dark dark:hover:bg-surface-hover-dark md:px-3">
                  {archivedT('columns.itemName')}
                </th>
                <th className="relative group w-[200px] min-w-[200px] max-w-[200px] cursor-pointer select-none px-2.5 py-2 text-left text-xs font-medium uppercase text-primary-text transition-colors hover:bg-surface-hover dark:text-primary-text-dark dark:hover:bg-surface-hover-dark md:px-3">
                  {archivedT('columns.archivedAt')}
                </th>
                <th className="sticky right-0 w-[100px] min-w-[100px] max-w-[150px] bg-surface-alt px-2.5 py-2 text-right text-xs font-medium uppercase text-primary-text dark:bg-surface-alt-dark dark:text-primary-text-dark md:px-3">
                  {archivedT('columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface dark:divide-border-dark dark:bg-surface-dark">
              {archivedItems.map((item) => (
                <tr
                  key={item.archiveId}
                  className="bg-surface hover:bg-surface-alt-hover dark:bg-surface-dark dark:hover:bg-surface-alt-hover-dark"
                >
                  <td className="px-2.5 py-1.5 md:px-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.archiveId)}
                      onChange={(e) => handleSelectItem(item.archiveId, e.target.checked)}
                      className="size-4 cursor-pointer accent-accent dark:accent-accent-dark"
                      aria-label={archivedT('actions.selectItem')}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-xs text-primary-text/70 dark:text-primary-text-dark/70 md:px-3">
                    {item.id}
                  </td>
                  <td className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-1.5 text-xs text-primary-text/70 dark:text-primary-text-dark/70 md:px-3">
                    {item.name}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-xs text-primary-text/70 dark:text-primary-text-dark/70 md:px-3">
                    {timeAgo(item.archivedAt, t)}
                  </td>
                  <td
                    className={`sticky right-0 z-10 flex bg-inherit px-2.5 py-1.5 text-right text-xs font-medium dark:bg-inherit md:px-3 ${isMobile ? 'flex-col' : 'flex-row'} items-center justify-end gap-1.5 whitespace-nowrap`}
                  >
                    <button
                      type="button"
                      onClick={() => handleRestore(item)}
                      className={`rounded-full p-1 text-green-500 transition-all duration-200 hover:bg-green-500/5 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-400/5 ${isMobile ? 'flex w-full items-center justify-center rounded-md py-1' : ''}`}
                      title={archivedT('actions.addToTorBox')}
                    >
                      {isMobile ? (
                        <div className="flex items-center justify-center gap-2">
                          <Restore /> {archivedT('actions.addToTorBox')}
                        </div>
                      ) : (
                        <Restore />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyMagnet(item)}
                      className={`rounded-full p-1 text-blue-500 transition-all duration-200 hover:bg-label-active-text/5 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-label-active-text-dark/5 ${isMobile ? 'flex w-full items-center justify-center rounded-md py-1' : ''}`}
                      title={archivedT('actions.copyMagnet')}
                    >
                      {isMobile ? (
                        <div className="flex items-center justify-center gap-2">
                          <Copy /> {archivedT('actions.copyMagnet')}
                        </div>
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className={`rounded-full p-1 text-red-500 transition-all duration-200 hover:bg-red-500/5 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-400/5 ${isMobile ? 'flex w-full items-center justify-center rounded-md py-1' : ''}`}
                      title={archivedT('actions.remove')}
                    >
                      {isMobile ? (
                        <div className="flex items-center justify-center gap-2">
                          <Times /> {archivedT('actions.remove')}
                        </div>
                      ) : (
                        <Times />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && resolvedPagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {t('showing') || 'Showing'}{' '}
            {(resolvedPagination.page - 1) * resolvedPagination.limit + 1} -{' '}
            {Math.min(resolvedPagination.page * resolvedPagination.limit, resolvedPagination.total)}{' '}
            {t('of') || 'of'} {resolvedPagination.total}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fetchPage(resolvedPagination.page - 1)}
              disabled={resolvedPagination.page === 1}
              className="rounded-md border border-border bg-surface px-4 py-2 text-primary-text hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-primary-text-dark dark:hover:bg-surface-alt-dark"
            >
              {t('previous') || 'Previous'}
            </button>
            <button
              type="button"
              onClick={() => fetchPage(resolvedPagination.page + 1)}
              disabled={resolvedPagination.page >= resolvedPagination.totalPages}
              className="rounded-md border border-border bg-surface px-4 py-2 text-primary-text hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-primary-text-dark dark:hover:bg-surface-alt-dark"
            >
              {t('next') || 'Next'}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

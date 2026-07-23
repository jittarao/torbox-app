'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useArchive } from '@/hooks/useArchive';
import useIsMobile from '@/hooks/useIsMobile';
import Spinner from '@/components/shared/Spinner';
import SearchBar from '@/components/LinkHistory/components/SearchBar';
import { useArchivedDownloadsActions } from './hooks/useArchivedDownloadsActions';
import { useShiftRangeRowSelection } from '@/hooks/useShiftRangeRowSelection';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useAppAlert } from '@/hooks/useAppAlert';
import ArchivedDownloadsEmptyState from './ArchivedDownloadsEmptyState';
import ArchivedDownloadsTable from './ArchivedDownloadsTable';
import ArchivedDownloadsPagination from './ArchivedDownloadsPagination';

export default function ArchivedDownloads({ apiKey }) {
  const t = useTranslations('Common');
  const archivedT = useTranslations('ArchivedDownloads');
  const isMobile = useIsMobile();
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

  const { confirm, ConfirmDialog } = useConfirmDialog({ cancelLabel: 'Cancel' });
  const { alert, AppAlert } = useAppAlert();

  const { bulkDeleting, handleBulkDelete, handleRemove } = useArchivedDownloadsActions(
    apiKey,
    fetchArchivedDownloads,
    setSelectedItems,
    removeFromArchive,
    confirm,
    alert
  );

  const archivedItems = getArchivedDownloads();
  const showInitialLoading = loading && archivedItems.length === 0;

  const getArchiveRowId = useCallback((item) => item.archiveId, []);
  const { buildSelectionUpdater, resetAnchor } = useShiftRangeRowSelection(
    archivedItems,
    getArchiveRowId
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    resetAnchor();
  }, [pagination.page, search, resetAnchor]);

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

  const handleSelectItem = useCallback(
    (archiveId, checked, rowIndex, isShiftKey = false) => {
      setSelectedItems(buildSelectionUpdater(archiveId, checked, rowIndex, isShiftKey));
    },
    [buildSelectionUpdater]
  );

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

  const onRemove = async (id) => {
    await handleRemove(
      id,
      () => alert(archivedT('toast.removed') || 'Removed from archive', 'success'),
      (err) => {
        console.error('Error removing from archive:', err);
        alert(err.message || archivedT('toast.removeError') || 'Failed to remove');
      }
    );
  };

  const handleRestore = async (download) => {
    try {
      await restoreFromArchive(download);
      alert(archivedT('toast.restored') || 'Added to TorBox', 'success');
    } catch (err) {
      console.error('Error restoring from archive:', err);
      alert(err.message || archivedT('toast.restoreError') || 'Failed to restore');
    }
  };

  const handleCopyMagnet = async (download) => {
    const encodedName = encodeURIComponent(download.name || 'Unknown');
    const magnetLink = `magnet:?xt=urn:btih:${download.hash}&dn=${encodedName}`;
    await navigator.clipboard.writeText(magnetLink);
    alert(archivedT('toast.magnetCopied'), 'success');
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

      {showInitialLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" className="text-primary-text dark:text-primary-text-dark" />
        </div>
      ) : null}

      {!showInitialLoading && archivedItems.length === 0 ? (
        <ArchivedDownloadsEmptyState archivedT={archivedT} search={search} />
      ) : null}

      {!showInitialLoading && archivedItems.length > 0 ? (
        <ArchivedDownloadsTable
          archivedItems={archivedItems}
          selectedItems={selectedItems}
          selectAllRef={selectAllRef}
          allSelected={allSelected}
          someSelected={someSelected}
          isMobile={isMobile}
          archivedT={archivedT}
          t={t}
          onSelectAll={handleSelectAll}
          onSelectItem={handleSelectItem}
          onRestore={handleRestore}
          onCopyMagnet={handleCopyMagnet}
          onRemove={onRemove}
        />
      ) : null}

      {!showInitialLoading ? (
        <ArchivedDownloadsPagination
          t={t}
          resolvedPagination={resolvedPagination}
          fetchPage={fetchPage}
        />
      ) : null}

      <ConfirmDialog />
      <AppAlert />
    </>
  );
}

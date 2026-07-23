'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '@/store/searchStore';
import { selectDisplayResults } from '@/store/searchSelectors';
import { useSearchFilterParams } from '@/hooks/useSearchFilterParams';
import Toast from '@/components/shared/Toast';
import Spinner from '@/components/shared/Spinner';
import { useUpload } from '@/components/shared/hooks/useUpload';
import SearchResultsToolbar from './SearchResultsToolbar';
import SearchResultRow from './SearchResultRow';

export default function SearchResults({ apiKey }) {
  const searchState = useSearchStore(
    useShallow((s) => ({
      query: s.query,
      hasSearchCompleted: s.hasSearchCompleted,
      results: s.results,
      loading: s.loading,
      error: s.error,
      searchType: s.searchType,
      clearResults: s.clearResults,
    }))
  );
  const { query, hasSearchCompleted, results, loading, error, searchType, clearResults } =
    searchState;
  const { filters } = useSearchFilterParams();
  const uploadAssetType = searchType === 'usenet' ? 'usenet' : 'torrents';
  const { uploadItem } = useUpload(apiKey, uploadAssetType);
  const [sortKey, setSortKey] = useState('seeders');
  const [sortDir, setSortDir] = useState('desc');
  const [toast, setToast] = useState(null);
  const [isUploading, setIsUploading] = useState({});
  const [showCachedOnly, setShowCachedOnly] = useState(false);
  const [addedItems, setAddedItems] = useState([]);
  const [hideTorBoxIndexers, setHideTorBoxIndexers] = useState(false);
  const t = useTranslations('SearchResults');

  const displayResults = useMemo(
    () =>
      selectDisplayResults(
        { ...searchState, results, searchType },
        { sortKey, sortDir, showCachedOnly, hideTorBoxIndexers },
        filters
      ),
    [
      searchState,
      results,
      searchType,
      sortKey,
      sortDir,
      showCachedOnly,
      hideTorBoxIndexers,
      filters,
    ]
  );

  useEffect(() => {
    clearResults();
  }, [apiKey, clearResults]);

  useEffect(() => {
    if (searchType === 'usenet' && sortKey === 'seeders') {
      setSortKey('age');
      setSortDir('asc');
    }
  }, [searchType, sortKey]);

  const copyLink = async (item) => {
    const link = searchType === 'usenet' ? item.nzb : item.magnet;
    await navigator.clipboard.writeText(link);
    setToast({
      message: t(`toast.${searchType === 'usenet' ? 'nzbCopied' : 'magnetCopied'}`),
      type: 'success',
    });
  };

  const handleUpload = async (item) => {
    setIsUploading((prev) => ({ ...prev, [item.hash]: true }));
    try {
      let result;
      if (searchType === 'usenet') {
        result = await uploadItem({
          type: 'usenet',
          data: item.nzb,
          name: item.raw_title || item.title,
          asQueued: false,
        });
      } else {
        result = await uploadItem({
          type: 'magnet',
          data: item.magnet,
          name: item.raw_title,
          seed: 3,
          allowZip: true,
          asQueued: false,
        });
      }

      if (!result.success) {
        throw new Error(result.error);
      }

      setAddedItems((prev) => [...prev, item]);

      setToast({
        message: t(`toast.${searchType === 'usenet' ? 'nzbAdded' : 'torrentAdded'}`),
        type: 'success',
      });
    } catch (err) {
      setToast({
        message: t(`toast.${searchType === 'usenet' ? 'nzbAddFailed' : 'torrentAddFailed'}`, {
          error: err.message,
        }),
        type: 'error',
      });
    } finally {
      setIsUploading((prev) => ({ ...prev, [item.hash]: false }));
    }
  };

  const showNoResults =
    hasSearchCompleted && Boolean(query) && !loading && !error && results.length === 0;
  const hasContent = loading || error || showNoResults || results.length > 0;

  if (!hasContent) return null;

  return (
    <div>
      {results.length > 0 && (
        <>
          <SearchResultsToolbar
            resultCount={displayResults.length}
            searchType={searchType}
            showCachedOnly={showCachedOnly}
            onShowCachedOnlyChange={setShowCachedOnly}
            hideTorBoxIndexers={hideTorBoxIndexers}
            onHideTorBoxIndexersChange={setHideTorBoxIndexers}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirToggle={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
          />

          <div className="min-w-0 space-y-4">
            {displayResults.map((item) => (
              <SearchResultRow
                key={item.hash}
                item={item}
                searchType={searchType}
                isUploading={Boolean(isUploading[item.hash])}
                isAdded={addedItems.some((addedItem) => addedItem.hash === item.hash)}
                onCopyLink={copyLink}
                onUpload={handleUpload}
              />
            ))}
          </div>
        </>
      )}

      {error && <div className="text-center py-4 text-red-500 dark:text-red-400">{error}</div>}

      {showNoResults && (
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold text-primary-text dark:text-primary-text-dark">
            {t('noResults')}
          </h2>
          <p className="mt-2 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {t('noResultsHint')}
          </p>
        </div>
      )}

      {loading && !results.length && (
        <div className="text-center py-4">
          <Spinner size="md" className="text-blue-500" />
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchStore } from '@/stores/searchStore';
import Dropdown from '@/components/shared/Dropdown';
import Toast from '@/components/shared/Toast';
import Spinner from '@/components/shared/Spinner';
import { useUpload } from '@/components/shared/hooks/useUpload';
import Icons from '@/components/icons';
import { formatSize } from '@/components/downloads/utils/formatters';

const TORBOX_NATIVE_TRACKERS = ['Newznab'];

const SORT_OPTIONS = {
  torrents: [
    { value: 'seeders', label: 'Most Seeders' },
    { value: 'size', label: 'Largest Size' },
    { value: 'age', label: 'Most Recent' },
  ],
  usenet: [
    { value: 'size', label: 'Largest Size' },
    { value: 'age', label: 'Most Recent' },
  ],
};

export default function SearchResults({ apiKey }) {
  const { results, loading, error, searchType } = useSearchStore();
  const { uploadItem } = useUpload(apiKey);
  const [sortKey, setSortKey] = useState('seeders');
  const [sortDir, setSortDir] = useState('desc');
  const [toast, setToast] = useState(null);
  const [isUploading, setIsUploading] = useState({});
  const [showCachedOnly, setShowCachedOnly] = useState(false);
  const [addedItems, setAddedItems] = useState([]);
  const [hideTorBoxIndexers, setHideTorBoxIndexers] = useState(false);
  const t = useTranslations('SearchResults');

  // Update sort key when search type changes
  useEffect(() => {
    if (searchType === 'usenet' && sortKey === 'seeders') {
      setSortKey('age');
      setSortDir('asc');
    }
  }, [searchType, sortKey]);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const modifier = sortDir === 'desc' ? -1 : 1;

      switch (sortKey) {
        case 'seeders': {
          if (searchType === 'usenet') return 0;
          const aValue = parseInt(a.last_known_seeders || 0, 10);
          const bValue = parseInt(b.last_known_seeders || 0, 10);
          return (aValue - bValue) * modifier;
        }
        case 'size': {
          // Size is usually in bytes, so BigInt handles large numbers better
          const aValue = BigInt(a.size || 0);
          const bValue = BigInt(b.size || 0);
          return Number(aValue - bValue) * modifier;
        }
        case 'age': {
          // Remove 'd' from age strings if present
          const aValue = parseInt(String(a.age).replace('d', '') || 0, 10);
          const bValue = parseInt(String(b.age).replace('d', '') || 0, 10);
          return (aValue - bValue) * modifier;
        }
        default:
          return 0;
      }
    });
  }, [results, sortKey, sortDir, searchType]);

  const filteredResults = useMemo(() => {
    let tempResults = sortedResults;
    if (hideTorBoxIndexers) {
      tempResults = tempResults.filter(
        (t) => !TORBOX_NATIVE_TRACKERS.includes(t.tracker),
      );
    }
    return showCachedOnly ? tempResults.filter((t) => t.cached) : tempResults;
  }, [sortedResults, showCachedOnly, hideTorBoxIndexers]);

  const copyLink = async (item) => {
    const link = searchType === 'usenet' ? item.nzb : item.magnet;
    await navigator.clipboard.writeText(link);
    setToast({
      message: t(
        `toast.${searchType === 'usenet' ? 'nzbCopied' : 'magnetCopied'}`,
      ),
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
          name: item.raw_title,
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
        message: t(
          `toast.${searchType === 'usenet' ? 'nzbAdded' : 'torrentAdded'}`,
        ),
        type: 'success',
      });
    } catch (err) {
      setToast({
        message: t(
          `toast.${searchType === 'usenet' ? 'nzbAddFailed' : 'torrentAddFailed'}`,
          { error: err.message },
        ),
        type: 'error',
      });
    } finally {
      setIsUploading((prev) => ({ ...prev, [item.hash]: false }));
    }
  };

  const handleSortChange = (newSortKey) => {
    setSortKey(newSortKey);
  };

  if (!results.length && !loading && !error) return null;

  return (
    <div>
      {results.length > 0 && (
        <>
          {/* Search results actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg md:text-xl font-semibold text-primary-text dark:text-primary-text-dark">
                {t('results', { count: filteredResults.length })}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer order-2 md:order-1">
                <span className="flex items-center gap-1 text-sm text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  {t('cachedOnly')}
                </span>

                <div
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                      ${
                        showCachedOnly
                          ? 'bg-accent dark:bg-accent-dark'
                          : 'bg-border dark:bg-border-dark'
                      }`}
                  onClick={() => setShowCachedOnly(!showCachedOnly)}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${showCachedOnly ? 'translate-x-4' : 'translate-x-1'}`}
                  />
                </div>
              </label>

              {/* Hide TorBox Trackers */}
              {searchType === 'usenet' && (
                <label className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                    <Icons.EyeOff />
                    {t('hideTorBoxIndexers')}
                  </span>

                  <div
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
              ${
                hideTorBoxIndexers
                  ? 'bg-accent dark:bg-accent-dark'
                  : 'bg-border dark:bg-border-dark'
              }`}
                    onClick={() => setHideTorBoxIndexers(!hideTorBoxIndexers)}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${hideTorBoxIndexers ? 'translate-x-4' : 'translate-x-1'}`}
                    />
                  </div>
                </label>
              )}

              <div className="flex items-center gap-2 flex-1 md:flex-none order-1 md:order-2">
                <Dropdown
                  options={SORT_OPTIONS[searchType]}
                  value={sortKey}
                  onChange={handleSortChange}
                  className="w-full md:w-40"
                />
                <button
                  onClick={() =>
                    setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
                  }
                  className="p-2 hover:text-accent dark:hover:text-accent-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark rounded-lg transition-colors shrink-0"
                >
                  {sortDir === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>
          </div>

          {/* Search results list */}
          <div className="space-y-4">
            {filteredResults.map((item) => (
              <div
                key={item.hash}
                className="p-4 rounded-lg border border-border dark:border-border-dark 
                         bg-surface dark:bg-surface-dark
                         hover:bg-surface-hover dark:hover:bg-surface-hover-dark space-y-3"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-medium dark:text-white">
                      {item.raw_title || item.title}
                    </h3>
                    {item.title_parsed_data && (
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className="bg-surface-alt dark:bg-surface-alt-dark 
                                       text-primary-text dark:text-primary-text-dark 
                                       px-1.5 py-0.5 rounded"
                        >
                          {item.title_parsed_data.resolution}
                        </span>
                        {item.title_parsed_data.quality && (
                          <span className="bg-surface-alt dark:bg-surface-alt-dark text-primary-text dark:text-primary-text-dark px-1.5 py-0.5 rounded">
                            {item.title_parsed_data.quality}
                          </span>
                        )}
                        {item.title_parsed_data.year && (
                          <span className="bg-surface-alt dark:bg-surface-alt-dark text-primary-text dark:text-primary-text-dark px-1.5 py-0.5 rounded">
                            {item.title_parsed_data.year}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <Icons.Layers />
                      {formatSize(item.size)}
                    </div>
                    {searchType === 'torrents' && (
                      <div className="flex items-center gap-1.5">
                        <Icons.UpArrow />
                        {item.last_known_seeders}
                        {item.last_known_peers > 0 &&
                          ` / ${item.last_known_peers}`}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Icons.Clock />
                      {String(item.age).replace('d', ` ${t('metadata.days')}`)}
                    </div>
                    {item.tracker && item.tracker !== 'Unknown' && (
                      <div className="flex items-center gap-1.5">
                        <Icons.Tracker />
                        {item.tracker}
                      </div>
                    )}
                    {item.cached && (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5">
                        <Icons.Bolt />
                        {t('metadata.cached')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Show copy button if search type is torrents or usenet and not a native tracker */}
                    {(searchType === 'torrents' ||
                      (searchType === 'usenet' &&
                        !TORBOX_NATIVE_TRACKERS.includes(item.tracker))) && (
                      <button
                        onClick={() => copyLink(item)}
                        className="shrink-0 px-3 py-1 text-sm bg-accent hover:bg-accent/90 
                              dark:bg-accent-dark dark:hover:bg-accent-dark/90
                              text-white rounded-md transition-colors"
                      >
                        {t(
                          `actions.${searchType === 'usenet' ? 'copyLink' : 'copyMagnet'}`,
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => handleUpload(item)}
                      disabled={
                        isUploading[item.hash] ||
                        addedItems.some(
                          (addedItem) => addedItem.hash === item.hash,
                        )
                      }
                      className={`shrink-0 px-3 py-1 text-sm text-white rounded-md transition-colors
                        ${
                          isUploading[item.hash]
                            ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                            : addedItems.some(
                                  (addedItem) => addedItem.hash === item.hash,
                                )
                              ? 'bg-label-default-text dark:bg-label-default-text-dark cursor-not-allowed'
                              : 'bg-label-success-text dark:bg-label-success-text-dark hover:bg-label-success-text/90 dark:hover:bg-label-success-text-dark/90'
                        }`}
                    >
                      {isUploading[item.hash] ? (
                        <span className="flex items-center gap-2">
                          <Spinner size="sm" className="text-white" />
                          {t('actions.adding')}
                        </span>
                      ) : addedItems.some(
                          (addedItem) => addedItem.hash === item.hash,
                        ) ? (
                        t('actions.added')
                      ) : (
                        t('actions.addToTorbox')
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="text-center py-4 text-red-500 dark:text-red-400">
          {error}
        </div>
      )}

      {!results.length && !loading && !error && (
        <div className="text-center py-4">
          <h2 className="text-xl font-semibold">{t('noResults')}</h2>
        </div>
      )}

      {loading && !results.length && (
        <div className="text-center py-4">
          <Spinner size="md" className="text-blue-500" />
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

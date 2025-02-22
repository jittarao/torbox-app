'use client';

import { useState, useMemo } from 'react';
import { useSearchStore } from '@/stores/searchStore';
import Dropdown from '@/components/shared/Dropdown';
import Toast from '@/components/shared/Toast';
import Spinner from '@/components/shared/Spinner';
import { useTorrentUpload } from '@/components/torrent/hooks/useTorrentUpload';

const SORT_OPTIONS = [
  { value: 'seeders', label: 'Most Seeders' },
  { value: 'size', label: 'Largest Size' },
  { value: 'age', label: 'Most Recent' }
];

export default function SearchResults({ apiKey }) {
  const { results, loading, fetchResults, error } = useSearchStore();
  const { uploadItem } = useTorrentUpload(apiKey);
  const [sortKey, setSortKey] = useState('seeders');
  const [sortDir, setSortDir] = useState('desc');
  const [toast, setToast] = useState(null);
  const [isUploading, setIsUploading] = useState({});
  const [showCachedOnly, setShowCachedOnly] = useState(false);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const modifier = sortDir === 'desc' ? -1 : 1;
      
      switch (sortKey) {
        case 'seeders': {
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
  }, [results, sortKey, sortDir]);

  const filteredResults = useMemo(() => {
    return showCachedOnly ? sortedResults.filter(t => t.cached) : sortedResults;
  }, [sortedResults, showCachedOnly]);

  const copyMagnet = async (magnet) => {
    await navigator.clipboard.writeText(magnet);
    setToast({
      message: 'Magnet link copied to clipboard',
      type: 'success'
    });
  };

  const handleUpload = async (torrent) => {
    setIsUploading(prev => ({ ...prev, [torrent.hash]: true }));
    try {
      await uploadItem({
        type: 'magnet',
        data: torrent.magnet,
        seed: 1,
        allowZip: true,
        asQueued: true
      });
      setToast({
        message: 'Torrent added to TorBox successfully',
        type: 'success'
      });
    } catch (err) {
      setToast({
        message: `Failed to add torrent: ${err.message}`,
        type: 'error' 
      });
    } finally {
      setIsUploading(prev => ({ ...prev, [torrent.hash]: false }));
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
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-primary-text dark:text-primary-text-dark">
                {filteredResults.length} results
              </h2>
            </div>
            <div className="flex items-center justify-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="flex items-center gap-1 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
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
                  Cached Only
                </span>

                <div 
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                    ${showCachedOnly 
                      ? 'bg-accent dark:bg-accent-dark' 
                      : 'bg-border dark:bg-border-dark'}`}
                  onClick={() => setShowCachedOnly(!showCachedOnly)}
                >
                  <span 
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${showCachedOnly ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </div>
              </label>
              <Dropdown
                options={SORT_OPTIONS}
                value={sortKey}
                onChange={handleSortChange}
                className="w-40"
              />
              <button
                onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                className="p-2 hover:bg-surface-hover dark:hover:bg-surface-hover-dark rounded-lg transition-colors"
              >
                {sortDir === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredResults.map((torrent) => (
              <div
                key={torrent.hash}
                className="p-4 rounded-lg border border-border dark:border-border-dark 
                           bg-surface dark:bg-surface-dark
                           hover:bg-surface-hover dark:hover:bg-surface-hover-dark space-y-3"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-medium dark:text-white">
                      {torrent.raw_title || torrent.title}
                    </h3>
                    {torrent.title_parsed_data && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-surface-alt dark:bg-surface-alt-dark 
                                       text-primary-text dark:text-primary-text-dark 
                                       px-1.5 py-0.5 rounded">
                          {torrent.title_parsed_data.resolution}
                        </span>
                        {torrent.title_parsed_data.quality && (
                          <span className="bg-surface-alt dark:bg-surface-alt-dark text-primary-text dark:text-primary-text-dark px-1.5 py-0.5 rounded">
                            {torrent.title_parsed_data.quality}
                          </span>
                        )}
                        {torrent.title_parsed_data.year && (
                          <span className="bg-surface-alt dark:bg-surface-alt-dark text-primary-text dark:text-primary-text-dark px-1.5 py-0.5 rounded">
                            {torrent.title_parsed_data.year}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                
                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {formatSize(torrent.size)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      {torrent.last_known_seeders}
                      {torrent.last_known_peers > 0 && ` / ${torrent.last_known_peers}`}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {String(torrent.age).replace('d', ' days')}
                    </div>
                    {torrent.cached && (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Cached
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => copyMagnet(torrent.magnet)}
                      className="shrink-0 px-3 py-1 text-sm bg-accent hover:bg-accent/90 
                                dark:bg-accent-dark dark:hover:bg-accent-dark/90
                                text-white rounded-md transition-colors"
                    >
                      Copy Magnet
                    </button>

                    <button 
                      onClick={() => handleUpload(torrent)}
                      disabled={isUploading[torrent.hash]}
                      className={`shrink-0 px-3 py-1 text-sm text-white rounded-md transition-colors
                        ${isUploading[torrent.hash] 
                          ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                          : 'bg-label-success-text dark:bg-label-success-text-dark hover:bg-label-success-text/90 dark:hover:bg-label-success-text-dark/90'
                        }`}
                    >
                      {isUploading[torrent.hash] ? (
                        <span className="flex items-center gap-2">
                          <Spinner size="sm" className="text-white" />
                          Adding...
                        </span>
                      ) : (
                        'Add to TorBox'
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
          <h2 className="text-xl font-semibold">No results found</h2>
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

function formatSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
} 
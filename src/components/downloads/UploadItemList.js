'use client';
import { useState, useMemo } from 'react';
import Spinner from '../shared/Spinner';

const INITIAL_DISPLAY_COUNT = 20;
const MAX_HEIGHT = '400px';

export default function UploadItemList({ items, setItems, uploading, activeType }) {
  const [showAll, setShowAll] = useState(false);

  const showItemOptions = activeType === 'torrents';

  // Create unique keys for items using index + data/name combination
  const itemsWithKeys = useMemo(
    () =>
      items.map((item, index) => ({
        ...item,
        originalIndex: index,
        uniqueKey: `${index}-${typeof item.data === 'string' ? item.data : item.name || item.data?.name || index}`,
      })),
    [items]
  );

  // Status counts
  const statusCounts = useMemo(() => {
    return {
      queued: items.filter((item) => item.status === 'queued').length,
      processing: items.filter((item) => item.status === 'processing').length,
      success: items.filter((item) => item.status === 'success').length,
      error: items.filter((item) => item.status === 'error').length,
    };
  }, [items]);

  // Determine which items to display
  const displayItems = useMemo(() => {
    if (showAll || items.length <= INITIAL_DISPLAY_COUNT) {
      return itemsWithKeys;
    }
    return itemsWithKeys.slice(0, INITIAL_DISPLAY_COUNT);
  }, [itemsWithKeys, showAll]);

  const hasMoreItems = items.length > INITIAL_DISPLAY_COUNT && !showAll;
  const remainingCount = items.length - INITIAL_DISPLAY_COUNT;

  // Early return after all hooks
  if (items.length === 0) return null;

  return (
    <div className="mt-4">
      {/* Status Summary */}
      {items.length > 10 && (
        <div className="mb-3 p-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg text-xs text-primary-text/70 dark:text-primary-text-dark/70">
          <div className="flex flex-wrap gap-3">
            {statusCounts.success > 0 && (
              <span>
                <span className="font-medium text-green-500 dark:text-green-400">
                  {statusCounts.success}
                </span>{' '}
                success
              </span>
            )}
            {statusCounts.queued > 0 && (
              <span>
                <span className="font-medium text-blue-500 dark:text-blue-400">
                  {statusCounts.queued}
                </span>{' '}
                queued
              </span>
            )}
            {statusCounts.error > 0 && (
              <span>
                <span className="font-medium text-red-500 dark:text-red-400">
                  {statusCounts.error}
                </span>{' '}
                error
              </span>
            )}
            {statusCounts.processing > 0 && (
              <span>
                <span className="font-medium text-yellow-500 dark:text-yellow-400">
                  {statusCounts.processing}
                </span>{' '}
                processing
              </span>
            )}
            <span className="ml-auto font-medium">Total: {items.length}</span>
          </div>
        </div>
      )}

      {/* Items List with Scrollable Container */}
      <div
        className={`space-y-2 ${
          items.length > INITIAL_DISPLAY_COUNT && !showAll
            ? 'max-h-[400px]'
            : items.length > 20
              ? 'max-h-[600px]'
              : ''
        } overflow-y-auto overflow-x-hidden pr-1`}
        style={
          items.length > INITIAL_DISPLAY_COUNT && !showAll
            ? { maxHeight: MAX_HEIGHT }
            : items.length > 20
              ? { maxHeight: '600px' }
              : {}
        }
      >
        {displayItems.map((item) => {
          const itemIndex = item.originalIndex;

          return (
            <div
              key={item.uniqueKey}
              className="flex justify-between items-center p-3 
            bg-surface-alt dark:bg-surface-alt-dark 
            border border-border dark:border-border-dark rounded-lg"
            >
              <div className="flex-1">
                <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                  {item.name}
                </span>
                {item.status === 'error' && item.error && (
                  <p className="text-xs text-red-500 mt-1">{item.error}</p>
                )}
                {item.status === 'queued' && showItemOptions && (
                  <div className="flex gap-4 mt-2">
                    <select
                      value={item.seed}
                      onChange={(e) => {
                        const updatedItems = items.map((i, idx) =>
                          idx === itemIndex ? { ...i, seed: Number(e.target.value) } : i
                        );
                        setItems(updatedItems);
                      }}
                      className="text-xs bg-transparent border border-border dark:border-border-dark 
                    rounded text-primary-text dark:text-primary-text-dark"
                    >
                      <option value={1}>Auto (Default)</option>
                      <option value={2}>Seed</option>
                      <option value={3}>Don't Seed</option>
                    </select>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={item.allowZip}
                        onChange={(e) => {
                          const updatedItems = items.map((i, idx) =>
                            idx === itemIndex ? { ...i, allowZip: e.target.checked } : i
                          );
                          setItems(updatedItems);
                        }}
                        className="mr-1 accent-accent dark:accent-accent-dark"
                      />
                      <span className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
                        Zip
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={item.asQueued}
                        onChange={(e) => {
                          const updatedItems = items.map((i, idx) =>
                            idx === itemIndex ? { ...i, asQueued: e.target.checked } : i
                          );
                          setItems(updatedItems);
                        }}
                        className="mr-1 accent-accent dark:accent-accent-dark"
                      />
                      <span className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
                        Queue
                      </span>
                    </label>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {item.status === 'queued' && !uploading && (
                  <button
                    onClick={() => {
                      const updatedItems = items.filter((_, idx) => idx !== itemIndex);
                      setItems(updatedItems);
                    }}
                    className="text-red-500 hover:text-red-600 transition-colors duration-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {item.status === 'success' && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-green-500"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {item.status === 'error' && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-red-500"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                )}
                {item.status === 'processing' && <Spinner size="sm" className="text-yellow-500" />}
                {item.status === 'queued' && uploading && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-gray-300"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show More / Show Less Button */}
      {hasMoreItems && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors px-4 py-2 border border-border dark:border-border-dark rounded-lg hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
          >
            Show {remainingCount} more item{remainingCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {showAll && items.length > INITIAL_DISPLAY_COUNT && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => setShowAll(false)}
            className="text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors px-4 py-2 border border-border dark:border-border-dark rounded-lg hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
          >
            Show less
          </button>
        </div>
      )}
    </div>
  );
}

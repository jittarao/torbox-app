'use client';

import { useTranslations } from 'next-intl';
import Spinner from '@/components/shared/Spinner';
import { Bolt, Clock, Layers, Tracker, UpArrow } from '@/components/icons';
import { formatSize } from '@/components/downloads/utils/formatters';
import { TORBOX_NATIVE_TRACKERS } from '@/store/searchSelectors';

export default function SearchResultRow({
  item,
  searchType,
  isUploading,
  isAdded,
  onCopyLink,
  onUpload,
}) {
  const t = useTranslations('SearchResults');

  return (
    <div
      className="min-w-0 overflow-hidden p-4 rounded-lg border border-border dark:border-border-dark 
                         bg-surface dark:bg-surface-dark
                         hover:bg-surface-hover dark:hover:bg-surface-hover-dark space-y-3"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="min-w-0 break-words text-sm font-medium md:text-lg dark:text-white">
            {item.raw_title || item.title}
          </h3>
          {item.title_parsed_data && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
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

      <div className="flex min-w-0 flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Layers />
            {formatSize(item.size)}
          </div>
          {searchType === 'torrents' && (
            <div className="flex items-center gap-1.5">
              <UpArrow />
              {item.last_known_seeders}
              {item.last_known_peers > 0 && ` / ${item.last_known_peers}`}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock />
            {String(item.age).replace('d', ` ${t('metadata.days')}`)}
          </div>
          {item.tracker && item.tracker !== 'Unknown' && (
            <div className="flex items-center gap-1.5">
              <Tracker />
              {item.tracker}
            </div>
          )}
          {item.cached && (
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5">
              <Bolt />
              {t('metadata.cached')}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 md:gap-4">
          {(searchType === 'torrents' ||
            (searchType === 'usenet' && !TORBOX_NATIVE_TRACKERS.includes(item.tracker))) && (
            <button
              type="button"
              onClick={() => onCopyLink(item)}
              className="shrink-0 px-3 py-1 text-sm bg-accent hover:bg-accent/90 
                              dark:bg-accent-dark dark:hover:bg-accent-dark/90
                              text-white rounded-md transition-colors"
            >
              {t(`actions.${searchType === 'usenet' ? 'copyLink' : 'copyMagnet'}`)}
            </button>
          )}

          <button
            type="button"
            onClick={() => onUpload(item)}
            disabled={isUploading || isAdded}
            className={`shrink-0 px-3 py-1 text-sm text-white rounded-md transition-colors
                        ${
                          isUploading
                            ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                            : isAdded
                              ? 'bg-label-default-text dark:bg-label-default-text-dark cursor-not-allowed'
                              : 'bg-label-success-text dark:bg-label-success-text-dark hover:bg-label-success-text/90 dark:hover:bg-label-success-text-dark/90'
                        }`}
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" className="text-white" />
                {t('actions.adding')}
              </span>
            ) : isAdded ? (
              t('actions.added')
            ) : (
              t('actions.addToTorBox')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { formatSize, formatSpeed, formatEta } from './utils/formatters';
import { getDownloadProgress } from './utils/downloadProgress';

/**
 * Shared progress display for download items.
 * @param {Object} props
 * @param {Object} props.item - Download item (torrent, usenet, webdl)
 * @param {'compact'|'full'} props.variant - compact: bar + % + size (e.g. mobile); full: + speed + ETA
 */
export default function DownloadProgressDisplay({ item, variant = 'full' }) {
  const commonT = useTranslations('Common');
  const { progress, downloadedSize, totalSize, downloadSpeed, etaSeconds, isActive } =
    getDownloadProgress(item);

  if (!isActive) {
    return <span className="text-primary-text/40 dark:text-primary-text-dark/40">-</span>;
  }

  const barHeight = variant === 'compact' ? 'h-1.5' : 'h-2';

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${barHeight}`}>
        <div
          className={`bg-accent dark:bg-accent-dark ${barHeight} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-primary-text/70 dark:text-primary-text-dark/70">
          {progress.toFixed(1)}%
          {variant === 'compact' && totalSize > 0 && (
            <span className="ml-1 text-primary-text/60 dark:text-primary-text-dark/60">
              · {formatSize(downloadedSize)} / {formatSize(totalSize)}
            </span>
          )}
        </span>
        {variant === 'full' && totalSize > 0 && (
          <span className="text-primary-text/60 dark:text-primary-text-dark/60">
            {formatSize(downloadedSize)} / {formatSize(totalSize)}
          </span>
        )}
      </div>

      {variant === 'full' && downloadSpeed > 0 && (
        <div className="flex items-center justify-between text-xs text-primary-text/60 dark:text-primary-text-dark/60">
          <span>↓ {formatSpeed(downloadSpeed)}</span>
          {etaSeconds > 0 && <span>ETA: {formatEta(etaSeconds, commonT)}</span>}
        </div>
      )}
    </div>
  );
}

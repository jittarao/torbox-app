'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';

/**
 * Error, stale-data, and refresh-paused feedback for the downloads list.
 */
export default function FetchStatusBanner({
  error,
  onDismissError,
  onRetry,
  lastSuccessfulFetchAt,
  refreshBlockedReason,
  pollingPaused,
}) {
  const t = useTranslations('FetchStatus');
  const [agoLabel, setAgoLabel] = useState(null);

  useEffect(() => {
    if (!lastSuccessfulFetchAt) {
      setAgoLabel(null);
      return;
    }

    const formatAgo = () => {
      const seconds = Math.floor((Date.now() - lastSuccessfulFetchAt) / 1000);
      if (seconds < 60) return t('updatedJustNow');
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return t('updatedMinutesAgo', { minutes });
      const hours = Math.floor(minutes / 60);
      return t('updatedHoursAgo', { hours });
    };

    setAgoLabel(formatAgo());
    const id = setInterval(() => setAgoLabel(formatAgo()), 30_000);
    return () => clearInterval(id);
  }, [lastSuccessfulFetchAt, t]);

  const showStaleHint = !error && (refreshBlockedReason === 'rate_limited' || pollingPaused);

  if (!error && !showStaleHint) return null;

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-label-danger-text/25 bg-label-danger-bg dark:bg-label-danger-bg-dark px-3 py-2"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <Icons.AlertCircle
              className="size-4 shrink-0 text-label-danger-text dark:text-label-danger-text-dark mt-0.5"
              aria-hidden
            />
            <p className="text-sm text-label-danger-text dark:text-label-danger-text-dark">
              {error}
            </p>
          </div>
          <div className="flex shrink-0 gap-2 sm:ml-2">
            <button
              type="button"
              onClick={onRetry}
              className="text-sm font-medium text-label-danger-text dark:text-label-danger-text-dark underline hover:no-underline"
            >
              {t('retry')}
            </button>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="text-sm text-label-danger-text/80 dark:text-label-danger-text-dark/80 hover:underline"
              >
                {t('dismiss')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const staleMessage =
    refreshBlockedReason === 'rate_limited'
      ? t('refreshDelayedRateLimit')
      : pollingPaused
        ? t('refreshPaused')
        : null;

  const statusText =
    staleMessage && agoLabel
      ? `${staleMessage} ${t('lastUpdated', { ago: agoLabel })}`
      : staleMessage || (agoLabel ? t('lastUpdated', { ago: agoLabel }) : null);

  return (
    <div
      role="status"
      className="rounded-lg border border-border dark:border-border-dark bg-surface-alt dark:bg-surface-alt-dark px-3 py-1.5 text-xs text-secondary-text dark:text-secondary-text-dark flex flex-wrap items-center justify-between gap-2"
    >
      <span>{statusText}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-medium text-primary-text dark:text-primary-text-dark hover:underline"
        >
          {t('refreshNow')}
        </button>
      )}
    </div>
  );
}

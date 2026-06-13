'use client';

import { getClientErrorMessage } from '@/components/shared/clientErrorDisplay';

/**
 * Presentational error fallback (no i18n). Use SectionErrorFallback in locale routes.
 */
export default function SectionErrorFallbackView({
  error,
  onRetry,
  title = 'Something went wrong',
  messageFallback = 'Something went wrong.',
  tryAgainLabel = 'Try again',
  reloadLabel = 'Reload page',
  showReload = false,
  className = '',
}) {
  const message = getClientErrorMessage(error, messageFallback);

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-4 rounded-lg border border-border/60 bg-surface/50 px-6 py-10 text-center dark:border-border-dark/60 dark:bg-surface-dark/50 ${className}`}
    >
      <h2 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
        {title}
      </h2>
      <p className="max-w-md text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {message}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-accent-dark"
          >
            {tryAgainLabel}
          </button>
        ) : null}
        {showReload ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-primary-text transition-colors hover:bg-surface-muted dark:border-border-dark dark:text-primary-text-dark dark:hover:bg-surface-muted-dark"
          >
            {reloadLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

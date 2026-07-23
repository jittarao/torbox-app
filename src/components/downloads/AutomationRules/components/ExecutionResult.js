'use client';

export default function ExecutionResult({ executionResult, t, onClose }) {
  if (!executionResult) return null;

  return (
    <div
      className={`mb-4 p-4 border rounded-lg ${
        executionResult.rateLimited
          ? 'bg-label-warning-bg dark:bg-label-warning-bg-dark border-label-warning-text/25'
          : 'bg-label-active-bg dark:bg-label-active-bg-dark border-label-active-text/25'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <svg
              className={`size-5 ${
                executionResult.rateLimited
                  ? 'text-label-warning-text dark:text-label-warning-text-dark'
                  : 'text-label-active-text dark:text-label-active-text-dark'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {executionResult.rateLimited ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              )}
            </svg>
            <h4
              className={`font-semibold ${
                executionResult.rateLimited
                  ? 'text-label-warning-text dark:text-label-warning-text-dark'
                  : 'text-label-active-text dark:text-label-active-text-dark'
              }`}
            >
              {executionResult.rateLimited
                ? t('ruleRateLimited') || 'Rule Rate Limited'
                : t('ruleExecuted') || 'Rule Executed'}
            </h4>
          </div>
          <div className="text-sm space-y-1 text-primary-text/80 dark:text-primary-text-dark/80">
            {executionResult.rateLimited ? (
              <p>{executionResult.reason || t('ruleRateLimitedDescription')}</p>
            ) : executionResult.skipped && executionResult.successCount === 0 ? (
              <>
                <p>
                  <strong>{executionResult.matchedTorrents}</strong>{' '}
                  {executionResult.matchedTorrents === 1
                    ? t('torrentMatched') || 'torrent matched'
                    : t('torrentsMatched') || 'torrents matched'}
                  .
                </p>
                <p>
                  <strong>0</strong> {t('actionsPerformed') || 'actions performed'}.
                </p>
              </>
            ) : executionResult.executed ? (
              <>
                <p>
                  <strong>{executionResult.matchedTorrents}</strong>{' '}
                  {executionResult.matchedTorrents === 1
                    ? t('torrentMatched') || 'torrent matched'
                    : t('torrentsMatched') || 'torrents matched'}
                  .
                </p>
                <p>
                  <strong>{executionResult.successCount}</strong>{' '}
                  {executionResult.successCount === 1
                    ? t('actionPerformed') || 'action performed'
                    : t('actionsPerformed') || 'actions performed'}
                  {executionResult.errorCount > 0 && (
                    <>
                      {' '}
                      ({executionResult.errorCount}{' '}
                      {executionResult.errorCount === 1
                        ? t('actionFailed') || 'action failed'
                        : t('actionsFailed') || 'actions failed'}
                      )
                    </>
                  )}
                  .
                </p>
              </>
            ) : (
              <p>
                {t('ruleEvaluatedNoActions') || 'Rule was evaluated but no actions were performed.'}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-primary-text/50 dark:text-primary-text-dark/50 hover:text-primary-text dark:hover:text-primary-text-dark transition-colors"
          aria-label={t('close') || 'Close'}
        >
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

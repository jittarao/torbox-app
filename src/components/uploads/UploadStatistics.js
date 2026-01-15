export default function UploadStatistics({ uploadStatistics }) {
  if (!uploadStatistics) return null;

  return (
    <div className="mt-4 p-4 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
            Upload Statistics (Last Hour)
          </h3>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-primary-text/70 dark:text-primary-text-dark/70">Total: </span>
              <span className="font-medium text-primary-text dark:text-primary-text-dark">
                {uploadStatistics.lastHour.total}
              </span>
              <span className="text-primary-text/50 dark:text-primary-text-dark/50">
                {' '}
                / {uploadStatistics.rateLimit.perHour}
              </span>
            </div>
            {uploadStatistics.lastHour.torrents > 0 && (
              <div>
                <span className="text-primary-text/70 dark:text-primary-text-dark/70">
                  Torrents:{' '}
                </span>
                <span className="font-medium text-primary-text dark:text-primary-text-dark">
                  {uploadStatistics.lastHour.torrents}
                </span>
              </div>
            )}
            {uploadStatistics.lastHour.usenets > 0 && (
              <div>
                <span className="text-primary-text/70 dark:text-primary-text-dark/70">
                  Usenets:{' '}
                </span>
                <span className="font-medium text-primary-text dark:text-primary-text-dark">
                  {uploadStatistics.lastHour.usenets}
                </span>
              </div>
            )}
            {uploadStatistics.lastHour.webdls > 0 && (
              <div>
                <span className="text-primary-text/70 dark:text-primary-text-dark/70">
                  WebDLs:{' '}
                </span>
                <span className="font-medium text-primary-text dark:text-primary-text-dark">
                  {uploadStatistics.lastHour.webdls}
                </span>
              </div>
            )}
          </div>
        </div>
        {uploadStatistics.lastHour.total >= uploadStatistics.rateLimit.perHour * 0.8 && (
          <div
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              uploadStatistics.lastHour.total >= uploadStatistics.rateLimit.perHour
                ? 'bg-yellow-500/20 text-yellow-600 dark:bg-yellow-400/20 dark:text-yellow-400'
                : 'bg-blue-500/20 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400'
            }`}
          >
            {uploadStatistics.lastHour.total >= uploadStatistics.rateLimit.perHour
              ? '⚠️ Rate limit reached'
              : '⚠️ Approaching rate limit'}
          </div>
        )}
      </div>
    </div>
  );
}

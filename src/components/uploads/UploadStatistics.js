const TYPE_CONFIG = [
  { lastHourKey: 'torrents', typeKey: 'torrent', label: 'Torrents' },
  { lastHourKey: 'usenets', typeKey: 'usenet', label: 'Usenets' },
  { lastHourKey: 'webdls', typeKey: 'webdl', label: 'WebDLs' },
];

const DEFAULT_HOURLY_LIMIT = 60;

function getTypeLimit(rateLimit, typeKey) {
  return rateLimit?.perType?.[typeKey] ?? rateLimit?.perHour ?? DEFAULT_HOURLY_LIMIT;
}

export default function UploadStatistics({ uploadStatistics }) {
  if (!uploadStatistics) return null;

  const { lastHour = {}, rateLimit } = uploadStatistics;

  const types = TYPE_CONFIG.map(({ lastHourKey, typeKey, label }) => {
    const limit = getTypeLimit(rateLimit, typeKey);
    const count = lastHour[lastHourKey] || 0;
    return { key: lastHourKey, label, count, limit };
  });

  const activeTypes = types.filter((t) => t.count > 0);
  const isAtLimit = activeTypes.some((t) => t.count >= t.limit);
  const isApproaching = !isAtLimit && activeTypes.some((t) => t.count >= t.limit * 0.8);

  return (
    <div className="mt-4 p-4 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
            Upload Statistics (Last Hour)
          </h3>
          <div className="flex gap-4 text-sm flex-wrap">
            {activeTypes.length > 0 ? (
              activeTypes.map((t) => (
                <div key={t.key}>
                  <span className="text-primary-text/70 dark:text-primary-text-dark/70">
                    {t.label}:{' '}
                  </span>
                  <span className="font-medium text-primary-text dark:text-primary-text-dark">
                    {t.count}
                  </span>
                  <span className="text-primary-text/50 dark:text-primary-text-dark/50">
                    {' '}
                    / {t.limit}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-primary-text/50 dark:text-primary-text-dark/50 text-sm">
                No activity in the last hour
              </span>
            )}
          </div>
        </div>
        {(isAtLimit || isApproaching) && (
          <div
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              isAtLimit
                ? 'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark'
                : 'bg-label-active-bg dark:bg-label-active-bg-dark text-label-active-text dark:text-label-active-text-dark'
            }`}
          >
            {isAtLimit ? '⚠️ Rate limit reached' : '⚠️ Approaching rate limit'}
          </div>
        )}
      </div>
    </div>
  );
}

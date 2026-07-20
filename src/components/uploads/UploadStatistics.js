'use client';

import { useTranslations } from 'next-intl';
import { formatTimeAgo } from './utils';

const TYPE_CONFIG = [
  { lastHourKey: 'torrents', typeKey: 'torrent', labelKey: 'typeTorrents' },
  { lastHourKey: 'usenets', typeKey: 'usenet', labelKey: 'typeUsenet' },
  { lastHourKey: 'webdls', typeKey: 'webdl', labelKey: 'typeWebdl' },
];

const DEFAULT_UNCACHED_HOURLY_LIMIT = 60;

function getTypeStats(lastHour, lastHourKey) {
  const entry = lastHour?.[lastHourKey];
  if (entry != null && typeof entry === 'object') {
    return {
      uncached: entry.uncached ?? 0,
      deferredCount: entry.deferredCount ?? 0,
      deferredUntil: entry.deferredUntil ?? null,
    };
  }
  const uncached = typeof entry === 'number' ? entry : 0;
  return { uncached, deferredCount: 0, deferredUntil: null };
}

function getTypeLimit(rateLimit, typeKey) {
  return (
    rateLimit?.perType?.[typeKey] ?? rateLimit?.uncachedPerHour ?? DEFAULT_UNCACHED_HOURLY_LIMIT
  );
}

export default function UploadStatistics({ uploadStatistics }) {
  const t = useTranslations('UploadStatistics');
  const tCommon = useTranslations('Common');

  if (!uploadStatistics) return null;

  const { lastHour = {}, rateLimit, retryAt } = uploadStatistics;

  const types = TYPE_CONFIG.map(({ lastHourKey, typeKey, labelKey }) => {
    const limit = getTypeLimit(rateLimit, typeKey);
    const stats = getTypeStats(lastHour, lastHourKey);
    return {
      key: lastHourKey,
      label: t(labelKey),
      ...stats,
      limit,
    };
  });

  const activeTypes = types.filter((type) => type.uncached > 0);
  const deferredTypes = types.filter((type) => type.deferredCount > 0);
  const totalDeferred = deferredTypes.reduce((sum, type) => sum + type.deferredCount, 0);
  const isAtLimit = activeTypes.some((type) => type.uncached >= type.limit);
  const isApproaching = !isAtLimit && activeTypes.some((type) => type.uncached >= type.limit * 0.8);
  const resumeTime = retryAt ? formatTimeAgo(retryAt, tCommon) : null;

  return (
    <div className="mt-4 p-4 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
            {t('title')}
          </h3>
          <div className="flex gap-4 text-sm flex-wrap">
            {activeTypes.length > 0 ? (
              activeTypes.map((type) => (
                <div key={type.key}>
                  <span className="text-primary-text/70 dark:text-primary-text-dark/70">
                    {type.label}:{' '}
                  </span>
                  <span className="font-medium text-primary-text dark:text-primary-text-dark">
                    {type.uncached}
                  </span>
                  <span className="text-primary-text/50 dark:text-primary-text-dark/50">
                    {' '}
                    {t('typeUncached', { limit: type.limit })}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-primary-text/50 dark:text-primary-text-dark/50 text-sm">
                {t('noUncached')}
              </span>
            )}
          </div>
          {deferredTypes.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 text-xs text-primary-text/70 dark:text-primary-text-dark/70">
              {deferredTypes.map((type) => (
                <div key={`defer-${type.key}`}>
                  {t('deferredTypeSummary', {
                    label: type.label,
                    count: type.deferredCount,
                    time: type.deferredUntil
                      ? formatTimeAgo(type.deferredUntil, tCommon)
                      : (resumeTime ?? t('soon')),
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        {(isAtLimit || isApproaching || totalDeferred > 0) && (
          <div className="flex flex-col items-end gap-1">
            {(isAtLimit || isApproaching) && (
              <div
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  isAtLimit
                    ? 'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark'
                    : 'bg-label-active-bg dark:bg-label-active-bg-dark text-label-active-text dark:text-label-active-text-dark'
                }`}
              >
                {isAtLimit ? t('rateLimitReached') : t('approachingRateLimit')}
              </div>
            )}
            {totalDeferred > 0 && resumeTime && (
              <div className="px-3 py-1.5 rounded text-xs font-medium bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark">
                {t('deferredSummary', { count: totalDeferred, time: resumeTime })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

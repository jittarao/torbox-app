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

function getUsageState(uncached, limit) {
  const pct = limit > 0 ? Math.min(100, Math.round((uncached / limit) * 100)) : 0;
  const isAtLimit = uncached >= limit;
  const isApproaching = !isAtLimit && uncached >= limit * 0.8;
  return { pct, isAtLimit, isApproaching };
}

function TypeUsageBar({ pct, isAtLimit, isApproaching }) {
  const barClass = isAtLimit
    ? 'bg-label-warning-text dark:bg-label-warning-text-dark'
    : isApproaching
      ? 'bg-label-active-text dark:bg-label-active-text-dark'
      : 'bg-accent dark:bg-accent-dark';

  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-surface dark:bg-surface-dark"
      role="presentation"
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${barClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function TypeStatCard({ type, t, tCommon }) {
  const { pct, isAtLimit, isApproaching } = getUsageState(type.uncached, type.limit);
  const resumeTime = type.deferredUntil ? formatTimeAgo(type.deferredUntil, tCommon) : null;

  const countClass = isAtLimit
    ? 'text-label-warning-text dark:text-label-warning-text-dark'
    : isApproaching
      ? 'text-label-active-text dark:text-label-active-text-dark'
      : 'text-primary-text dark:text-primary-text-dark';

  return (
    <div className="rounded-md border border-border/60 bg-surface/50 px-3 py-2.5 dark:border-border-dark/60 dark:bg-surface-dark/40">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
          {type.label}
        </span>
        <span className="text-sm tabular-nums">
          <span className={`font-semibold ${countClass}`}>{type.uncached}</span>
          <span className="text-primary-text/45 dark:text-primary-text-dark/45">
            {' '}
            / {type.limit}
          </span>
        </span>
      </div>

      <TypeUsageBar pct={pct} isAtLimit={isAtLimit} isApproaching={isApproaching} />

      {type.deferredCount > 0 && (
        <p className="mt-2 text-xs text-primary-text/60 dark:text-primary-text-dark/60">
          <span className="font-medium text-primary-text/75 dark:text-primary-text-dark/75">
            {t('deferredCount', { count: type.deferredCount })}
          </span>
          {resumeTime && (
            <>
              <span
                aria-hidden
                className="mx-1.5 text-primary-text/30 dark:text-primary-text-dark/30"
              >
                ·
              </span>
              {t('resumesIn', { time: resumeTime })}
            </>
          )}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ isAtLimit, isApproaching, label }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isAtLimit
          ? 'bg-label-warning-bg text-label-warning-text dark:bg-label-warning-bg-dark dark:text-label-warning-text-dark'
          : 'bg-label-active-bg text-label-active-text dark:bg-label-active-bg-dark dark:text-label-active-text-dark'
      }`}
    >
      {label}
    </span>
  );
}

export default function UploadStatistics({ uploadStatistics }) {
  const t = useTranslations('UploadStatistics');
  const tCommon = useTranslations('Common');

  if (!uploadStatistics) return null;

  const { lastHour = {}, rateLimit } = uploadStatistics;

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

  const visibleTypes = types.filter((type) => type.uncached > 0 || type.deferredCount > 0);
  const isAtLimit = visibleTypes.some((type) => type.uncached >= type.limit);
  const isApproaching =
    !isAtLimit && visibleTypes.some((type) => type.uncached >= type.limit * 0.8);

  if (visibleTypes.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-border/70 bg-surface-alt/40 px-4 py-3 dark:border-border-dark/70 dark:bg-surface-alt-dark/30">
        <p className="text-sm text-primary-text/50 dark:text-primary-text-dark/50">
          {t('noUncached')}
        </p>
      </div>
    );
  }

  return (
    <section
      className="mt-4 rounded-lg border border-border dark:border-border-dark bg-surface-alt/50 dark:bg-surface-alt-dark/40"
      aria-label={t('title')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 dark:border-border-dark/60">
        <h3 className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
          {t('title')}
        </h3>
        {(isAtLimit || isApproaching) && (
          <StatusBadge
            isAtLimit={isAtLimit}
            isApproaching={isApproaching}
            label={isAtLimit ? t('rateLimitReached') : t('approachingRateLimit')}
          />
        )}
      </div>

      <div
        className={`grid gap-2 p-3 ${
          visibleTypes.length === 1
            ? 'grid-cols-1'
            : visibleTypes.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {visibleTypes.map((type) => (
          <TypeStatCard key={type.key} type={type} t={t} tCommon={tCommon} />
        ))}
      </div>
    </section>
  );
}

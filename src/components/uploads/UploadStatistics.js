'use client';

import { useTranslations } from 'next-intl';
import { formatTimeAgo } from './utils';

const TYPE_CONFIG = [
  { typeKey: 'torrent', labelKey: 'typeTorrents' },
  { typeKey: 'usenet', labelKey: 'typeUsenet' },
  { typeKey: 'webdl', labelKey: 'typeWebdl' },
];

function getTypeStats(byType, typeKey) {
  const entry = byType?.[typeKey];
  if (entry != null && typeof entry === 'object') {
    return {
      limit: entry.limit ?? null,
      remaining: entry.remaining ?? null,
      used: entry.used ?? null,
      known: entry.known === true,
      resetAt: entry.resetAt ?? null,
      deferredCount: entry.deferredCount ?? 0,
      deferredUntil: entry.deferredUntil ?? null,
      pausedCount: entry.pausedCount ?? 0,
      pausedUntil: entry.pausedUntil ?? null,
      pauseReason: entry.pauseReason ?? null,
    };
  }
  return {
    limit: null,
    remaining: null,
    used: null,
    known: false,
    resetAt: null,
    deferredCount: 0,
    deferredUntil: null,
    pausedCount: 0,
    pausedUntil: null,
    pauseReason: null,
  };
}

function getUsageState(type) {
  if (!type.known || type.limit == null || type.remaining == null) {
    return { pct: 0, isAtLimit: false, isApproaching: false, showBar: false };
  }
  const used = type.used ?? Math.max(0, type.limit - type.remaining);
  const pct = type.limit > 0 ? Math.min(100, Math.round((used / type.limit) * 100)) : 0;
  const isAtLimit = type.remaining <= 0;
  const isApproaching = !isAtLimit && used >= type.limit * 0.8;
  return { pct, isAtLimit, isApproaching, showBar: true, used };
}

function getQueueStatusCopy(type, t, tCommon) {
  if (type.deferredCount > 0) {
    return {
      waitingLabel: t('rateLimitedWaiting', { count: type.deferredCount }),
      resumeLabel: type.deferredUntil
        ? t('firstSlotOpens', { time: formatTimeAgo(type.deferredUntil, tCommon) })
        : type.resetAt
          ? t('resumesIn', { time: formatTimeAgo(type.resetAt, tCommon) })
          : null,
    };
  }

  if (type.pausedCount > 0) {
    const waitingKey =
      type.pauseReason === 'connection'
        ? 'connectionPausedWaiting'
        : type.pauseReason === 'transient'
          ? 'transientPausedWaiting'
          : 'rateLimitedWaiting';

    return {
      waitingLabel: t(waitingKey, { count: type.pausedCount }),
      resumeLabel: type.pausedUntil
        ? t('resumesProcessing', { time: formatTimeAgo(type.pausedUntil, tCommon) })
        : null,
    };
  }

  return { waitingLabel: null, resumeLabel: null };
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
  const usage = getUsageState(type);
  const { waitingLabel, resumeLabel } = getQueueStatusCopy(type, t, tCommon);

  const countClass = usage.isAtLimit
    ? 'text-label-warning-text dark:text-label-warning-text-dark'
    : usage.isApproaching
      ? 'text-label-active-text dark:text-label-active-text-dark'
      : 'text-primary-text dark:text-primary-text-dark';

  const countLabel = type.known
    ? usage.showBar
      ? `${usage.used ?? 0} / ${type.limit}`
      : t('quotaUnknown')
    : t('quotaUnknown');

  return (
    <div className="rounded-md border border-border/60 bg-surface/50 px-3 py-2.5 dark:border-border-dark/60 dark:bg-surface-dark/40">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
          {type.label}
        </span>
        <span className={`text-sm tabular-nums ${countClass}`}>{countLabel}</span>
      </div>

      {usage.showBar && (
        <TypeUsageBar
          pct={usage.pct}
          isAtLimit={usage.isAtLimit}
          isApproaching={usage.isApproaching}
        />
      )}

      {type.known && type.remaining != null && type.limit != null && (
        <p className="mt-1.5 text-xs text-primary-text/50 dark:text-primary-text-dark/50">
          {t('remainingQuota', { remaining: type.remaining, limit: type.limit })}
        </p>
      )}

      {waitingLabel && (
        <p className="mt-2 text-xs text-primary-text/60 dark:text-primary-text-dark/60">
          <span className="font-medium text-primary-text/75 dark:text-primary-text-dark/75">
            {waitingLabel}
          </span>
          {resumeLabel && (
            <>
              <span
                aria-hidden
                className="mx-1.5 text-primary-text/30 dark:text-primary-text-dark/30"
              >
                ·
              </span>
              {resumeLabel}
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

  const { byType = {} } = uploadStatistics;

  const types = TYPE_CONFIG.map(({ typeKey, labelKey }) => {
    const stats = getTypeStats(byType, typeKey);
    return {
      key: typeKey,
      label: t(labelKey),
      ...stats,
    };
  });

  const visibleTypes = types.filter((type) => {
    if (type.deferredCount > 0 || type.pausedCount > 0) {
      return true;
    }
    if (!type.known) {
      return false;
    }
    if (type.limit == null || type.remaining == null) {
      return false;
    }
    return type.remaining < type.limit;
  });

  const isAtLimit = visibleTypes.some(
    (type) => type.known && type.remaining != null && type.remaining <= 0
  );
  const isApproaching =
    !isAtLimit &&
    visibleTypes.some((type) => {
      if (!type.known || type.limit == null || type.remaining == null) {
        return false;
      }
      const used = type.used ?? type.limit - type.remaining;
      return used >= type.limit * 0.8;
    });

  if (visibleTypes.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-border/70 bg-surface-alt/40 px-4 py-3 dark:border-border-dark/70 dark:bg-surface-alt-dark/30">
        <p className="text-sm text-primary-text/50 dark:text-primary-text-dark/50">
          {t('noQuotaActivity')}
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

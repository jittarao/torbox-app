'use client';

import { useTranslations } from 'next-intl';
import { formatTimeAgo } from './utils';

const TYPE_CONFIG = [
  { typeKey: 'torrent', labelKey: 'typeTorrents' },
  { typeKey: 'usenet', labelKey: 'typeUsenet' },
  { typeKey: 'webdl', labelKey: 'typeWebdl' },
];

/** Live header snapshots above this look like TorBox's cached short-window envelope. */
const UNCACHED_LIVE_LIMIT_MAX = 120;

function getWindowStats(entry) {
  const window = entry?.window;
  if (window == null || typeof window !== 'object') {
    return null;
  }
  return {
    uncachedUsed: window.uncachedUsed ?? 0,
    uncachedLimit: window.uncachedLimit ?? 60,
    uncachedResetAt: window.uncachedResetAt ?? null,
  };
}

function isUncachedLiveQuota(type) {
  return (
    type.known === true &&
    type.limit != null &&
    type.limit > 0 &&
    type.limit <= UNCACHED_LIVE_LIMIT_MAX
  );
}

function getTypeStats(byType, typeKey) {
  const entry = byType?.[typeKey];
  if (entry != null && typeof entry === 'object') {
    return {
      limit: entry.limit ?? null,
      remaining: entry.remaining ?? null,
      used: entry.used ?? null,
      known: entry.known === true,
      resetAt: entry.resetAt ?? null,
      window: getWindowStats(entry),
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
    window: null,
    deferredCount: 0,
    deferredUntil: null,
    pausedCount: 0,
    pausedUntil: null,
    pauseReason: null,
  };
}

function getBudgetUsageState(used, limit) {
  if (limit == null || used == null) {
    return { pct: 0, isAtLimit: false, isApproaching: false, showBar: false, used: null };
  }
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isAtLimit = used >= limit;
  const isApproaching = !isAtLimit && used >= limit * 0.8;
  return { pct, isAtLimit, isApproaching, showBar: used > 0 || isAtLimit, used };
}

function getLiveHeaderUsed(type) {
  return (
    type.used ??
    (type.remaining != null && type.limit != null ? Math.max(0, type.limit - type.remaining) : null)
  );
}

/** Prefer durable window when it has activity; otherwise live uncached headers. */
function shouldShowWindowBudget(type) {
  return type.window != null && type.window.uncachedUsed > 0;
}

function getDisplayedBudgetState(type) {
  if (shouldShowWindowBudget(type)) {
    return getBudgetUsageState(type.window.uncachedUsed, type.window.uncachedLimit);
  }
  if (isUncachedLiveQuota(type)) {
    return getBudgetUsageState(getLiveHeaderUsed(type), type.limit);
  }
  return { pct: 0, isAtLimit: false, isApproaching: false, showBar: false, used: null };
}

/** At-limit if the displayed budget is exhausted, or live headers report remaining === 0. */
function typeIsAtLimit(type) {
  if (isUncachedLiveQuota(type) && type.remaining != null && type.remaining <= 0) {
    return true;
  }
  return getDisplayedBudgetState(type).isAtLimit;
}

function typeIsApproaching(type) {
  if (typeIsAtLimit(type)) {
    return false;
  }
  return getDisplayedBudgetState(type).isApproaching;
}

function getQueueStatusCopy(type, t, tCommon) {
  if (type.deferredCount > 0) {
    return {
      waitingLabel: t('rateLimitedWaiting', { count: type.deferredCount }),
      resumeLabel: type.deferredUntil
        ? t('firstSlotOpens', { time: formatTimeAgo(type.deferredUntil, tCommon) })
        : type.window?.uncachedResetAt
          ? t('resumesIn', { time: formatTimeAgo(type.window.uncachedResetAt, tCommon) })
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

function BudgetRow({ label, used, limit, t }) {
  const usage = getBudgetUsageState(used, limit);
  if (!usage.showBar && used === 0) {
    return null;
  }

  const countClass = usage.isAtLimit
    ? 'text-label-warning-text dark:text-label-warning-text-dark'
    : usage.isApproaching
      ? 'text-label-active-text dark:text-label-active-text-dark'
      : 'text-primary-text dark:text-primary-text-dark';

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-primary-text/60 dark:text-primary-text-dark/60">{label}</span>
        <span className={`text-xs tabular-nums ${countClass}`}>
          {usage.used ?? 0} / {limit}
        </span>
      </div>
      {usage.showBar && (
        <TypeUsageBar
          pct={usage.pct}
          isAtLimit={usage.isAtLimit}
          isApproaching={usage.isApproaching}
        />
      )}
      <p className="text-[11px] text-primary-text/45 dark:text-primary-text-dark/45">
        {t('remainingQuota', {
          remaining: Math.max(0, limit - (usage.used ?? 0)),
          limit,
        })}
      </p>
    </div>
  );
}

function TypeStatCard({ type, t, tCommon }) {
  const { waitingLabel, resumeLabel } = getQueueStatusCopy(type, t, tCommon);
  const window = type.window;
  const showWindow = shouldShowWindowBudget(type);
  const showLive = isUncachedLiveQuota(type);
  const headerUsed = getLiveHeaderUsed(type);
  const headerUsage = getBudgetUsageState(headerUsed, type.limit);

  return (
    <div className="rounded-md border border-border/60 bg-surface/50 px-3 py-2.5 dark:border-border-dark/60 dark:bg-surface-dark/40">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
          {type.label}
        </span>
      </div>

      {showWindow ? (
        <BudgetRow
          label={t('budgetUncached')}
          used={window.uncachedUsed}
          limit={window.uncachedLimit}
          t={t}
        />
      ) : showLive && headerUsage.showBar ? (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-primary-text/60 dark:text-primary-text-dark/60">
              {t('budgetLive')}
            </span>
            <span
              className={`text-xs tabular-nums ${
                headerUsage.isAtLimit
                  ? 'text-label-warning-text dark:text-label-warning-text-dark'
                  : headerUsage.isApproaching
                    ? 'text-label-active-text dark:text-label-active-text-dark'
                    : 'text-primary-text dark:text-primary-text-dark'
              }`}
            >
              {headerUsage.used ?? 0} / {type.limit}
            </span>
          </div>
          <TypeUsageBar
            pct={headerUsage.pct}
            isAtLimit={headerUsage.isAtLimit}
            isApproaching={headerUsage.isApproaching}
          />
        </div>
      ) : (
        <p className="text-xs text-primary-text/50 dark:text-primary-text-dark/50">
          {t('quotaUnknown')}
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

function typeHasQuotaActivity(type) {
  if (type.deferredCount > 0 || type.pausedCount > 0) {
    return true;
  }
  if (type.window != null && type.window.uncachedUsed > 0) {
    return true;
  }
  if (!isUncachedLiveQuota(type)) {
    return false;
  }
  const used =
    type.used ?? (type.remaining != null ? Math.max(0, type.limit - type.remaining) : null);
  if (used != null && used > 0) {
    return true;
  }
  if (type.remaining == null) {
    return false;
  }
  return type.remaining < type.limit;
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

  const visibleTypes = types.filter(typeHasQuotaActivity);

  const isAtLimit = visibleTypes.some(typeIsAtLimit);
  const isApproaching = !isAtLimit && visibleTypes.some(typeIsApproaching);

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

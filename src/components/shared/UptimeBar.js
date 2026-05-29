'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { calculateUptimePercent, padHistoryForDisplay } from '@/utils/healthHistory';
import { CheckCircle, ExclamationTriangle } from '@/components/icons';

const SEGMENT_CLASS = {
  up: 'status-uptime-segment--up',
  degraded: 'status-uptime-segment--degraded',
  down: 'status-uptime-segment--down',
  nodata: 'status-uptime-segment--nodata',
  unknown: 'status-uptime-segment--unknown',
  empty: 'status-uptime-segment--empty',
};

function segmentLabel(t, segment) {
  switch (segment) {
    case 'up':
      return t('uptime.segment.up');
    case 'degraded':
      return t('uptime.segment.degraded');
    case 'down':
      return t('uptime.segment.down');
    case 'nodata':
      return t('uptime.segment.nodata');
    case 'empty':
      return t('uptime.segment.empty');
    default:
      return t('uptime.segment.unknown');
  }
}

function formatSegmentTime(t, at) {
  if (!at) return '';
  const diff = Date.now() - at;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgo', { hours });
  const days = Math.floor(hours / 24);
  return t('uptime.daysAgo', { days });
}

export default function UptimeBar({ label, history, currentStatus }) {
  const t = useTranslations('SystemStatus');

  const padded = useMemo(
    () => padHistoryForDisplay(history, currentStatus),
    [history, currentStatus]
  );
  const uptime = useMemo(() => {
    const recorded = history.filter((e) => e.at != null);
    if (recorded.length === 0) {
      return currentStatus === 'unhealthy' ? 0 : 100;
    }
    return calculateUptimePercent(history, currentStatus);
  }, [history, currentStatus]);

  const isHealthy = currentStatus === 'healthy';
  const HeaderIcon = isHealthy ? CheckCircle : ExclamationTriangle;
  const headerIconClass = isHealthy
    ? 'text-emerald-500 dark:text-emerald-400'
    : currentStatus === 'invalid-key' || currentStatus === 'unhealthy'
      ? 'text-red-500 dark:text-red-400'
      : 'text-amber-500 dark:text-amber-400';

  const uptimeText = t('uptime.percent', {
    percent: uptime >= 99.95 ? uptime.toFixed(1) : uptime.toFixed(2),
  });

  return (
    <div className="py-2.5 border-b border-zinc-200/80 dark:border-zinc-700/80 last:border-0 min-w-0">
      <div className="flex items-center justify-between gap-x-2 gap-y-0.5 mb-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <HeaderIcon className={`h-4 w-4 shrink-0 ${headerIconClass}`} aria-hidden />
          <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
            {label}
          </span>
        </div>
        <span
          className={`shrink-0 text-[11px] tabular-nums font-medium ${
            uptime != null && uptime >= 99
              ? 'text-emerald-600 dark:text-emerald-400'
              : uptime != null && uptime >= 95
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-zinc-500'
          }`}
        >
          {uptimeText}
        </span>
      </div>

      <div className="status-uptime-bar min-w-0 w-full" aria-hidden>
        {padded.map((entry, index) => {
          const segment = entry.s || 'empty';
          const title = entry.at
            ? `${segmentLabel(t, segment)} · ${formatSegmentTime(t, entry.at)}`
            : undefined;

          return (
            <span
              key={`${segment}-${index}`}
              className={`status-uptime-segment ${SEGMENT_CLASS[segment] || SEGMENT_CLASS.empty}`}
              title={title}
            />
          );
        })}
      </div>
      <div aria-live="polite" className="sr-only">
        {t('uptime.barLabel', { label, percent: uptime?.toFixed(1) ?? '—' })}
      </div>
    </div>
  );
}

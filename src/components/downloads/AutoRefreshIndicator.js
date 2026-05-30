'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Refresh } from '@/components/icons';

const RING_SIZE = 36;
const RING_RADIUS = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function getSecondsUntil(nextPollAt) {
  if (!nextPollAt) return null;
  return Math.max(0, Math.ceil((nextPollAt - Date.now()) / 1000));
}

function ProgressRing({ progress, className = '' }) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <svg
      className={`absolute inset-0 w-full h-full -rotate-90 pointer-events-none ${className}`}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden
    >
      <circle
        className="text-border/80 dark:text-border-dark/80"
        strokeWidth="2"
        stroke="currentColor"
        fill="transparent"
        r={RING_RADIUS}
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
      />
      <circle
        className="text-accent dark:text-accent-dark transition-[stroke-dashoffset] duration-150 ease-linear"
        strokeWidth="2"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r={RING_RADIUS}
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
      />
    </svg>
  );
}

/**
 * Countdown + manual refresh control for the downloads list auto-poll timer.
 */
export default function AutoRefreshIndicator({
  pollSchedule,
  isRefreshing = false,
  refreshRateLimited = false,
  onRefreshNow,
  className = '',
}) {
  const t = useTranslations('FetchStatus');
  const [tick, setTick] = useState(0);

  const nextPollAt = pollSchedule?.nextPollAt ?? null;
  const intervalMs = pollSchedule?.intervalMs ?? 0;
  const mode = pollSchedule?.mode ?? 'inactive';

  useEffect(() => {
    if (!nextPollAt || mode === 'paused' || mode === 'inactive') return;
    // Countdown is second-granular; 1s ticks avoid 4 renders/sec in dev (Styles pane flash).
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [nextPollAt, mode]);

  const secondsLeft = useMemo(() => {
    tick;
    return getSecondsUntil(nextPollAt);
  }, [nextPollAt, tick]);

  const progress = useMemo(() => {
    tick;
    if (!nextPollAt || !intervalMs || mode === 'paused' || mode === 'inactive') return 0;
    const remaining = Math.max(0, nextPollAt - Date.now());
    return 1 - remaining / intervalMs;
  }, [nextPollAt, intervalMs, mode, tick]);

  const statusLabel = useCallback(() => {
    if (isRefreshing) return t('refreshing');
    if (refreshRateLimited) return t('refreshDelayedRateLimit');
    if (mode === 'paused') return t('refreshPaused');
    if (mode === 'inactive') return t('autoRefreshInactive');
    if (mode === 'autoStartQueued') {
      return secondsLeft != null
        ? t('nextRefreshSlow', { seconds: secondsLeft })
        : t('autoRefreshSlowHint');
    }
    if (mode === 'autoStartWatch') {
      return secondsLeft != null
        ? t('nextRefreshWatch', { seconds: secondsLeft })
        : t('autoRefreshWatchHint');
    }
    if (secondsLeft != null && secondsLeft > 0) {
      return t('nextRefreshIn', { seconds: secondsLeft });
    }
    return t('refreshingSoon');
  }, [isRefreshing, refreshRateLimited, mode, secondsLeft, t]);

  const showCountdown =
    mode === 'active' || mode === 'autoStartQueued' || mode === 'autoStartWatch';
  const ringMuted = mode === 'paused' || mode === 'inactive';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onRefreshNow}
        disabled={isRefreshing || refreshRateLimited}
        title={statusLabel()}
        aria-label={`${statusLabel()}. ${t('refreshNow')}`}
        className={`
          group relative flex items-center justify-center shrink-0
          size-9 rounded-full
          border border-border/60 dark:border-border-dark/60
          bg-surface/90 dark:bg-surface-dark/90 backdrop-blur-sm
          shadow-sm
          transition-colors duration-200
          hover:border-accent/50 dark:hover:border-accent-dark/50
          hover:bg-surface-alt dark:hover:bg-surface-alt-dark
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:focus-visible:ring-accent-dark
          disabled:opacity-60 disabled:pointer-events-none
        `}
      >
        {!ringMuted && showCountdown && <ProgressRing progress={progress} />}
        <Refresh
          className={`relative z-10 size-4 text-secondary-text dark:text-secondary-text-dark group-hover:text-accent dark:group-hover:text-accent-dark transition-colors ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          aria-hidden
        />
      </button>
      <span className="sr-only" aria-live="polite">
        {statusLabel()}
      </span>
    </div>
  );
}

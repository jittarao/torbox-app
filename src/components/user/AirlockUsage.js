'use client';

import { useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { formatSize, SIZE_BASE_DECIMAL } from '@/components/downloads/utils/formatters';
import { AIRLOCK_HELP_URL } from '@/components/constants';
import {
  AIRLOCK_DOT_COUNT,
  getAirlockFilledDots,
  getAirlockPercent,
  isAirlockOverLimit,
} from '@/utils/airlockUsage';
import { AlertCircle, Lock, QuestionMarkCircle } from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import Tooltip from '@/components/shared/Tooltip';

export default function AirlockUsage({ usedBytes, limitBytes, loading, error, onRetry }) {
  const t = useTranslations('User.airlock');
  const locale = useLocale();

  const percent = useMemo(() => getAirlockPercent(usedBytes, limitBytes), [usedBytes, limitBytes]);
  const overLimit = useMemo(
    () => isAirlockOverLimit(usedBytes, limitBytes),
    [usedBytes, limitBytes]
  );
  const filledDots = useMemo(() => getAirlockFilledDots(percent), [percent]);

  const formatTransferBytes = useCallback(
    (bytes) => formatSize(bytes ?? 0, locale, SIZE_BASE_DECIMAL),
    [locale]
  );

  const dotColorClass = overLimit
    ? 'bg-red-400 dark:bg-red-400'
    : 'bg-emerald-400 dark:bg-emerald-400';
  const emptyDotColorClass = 'bg-border dark:bg-border-dark';

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Lock className="size-5 text-accent dark:text-accent-dark shrink-0" />
          <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark truncate">
            {t('title')}
          </h3>
          <Tooltip content={t('helpTooltip')}>
            <a
              href={AIRLOCK_HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted dark:text-muted-dark hover:text-primary-text dark:hover:text-primary-text-dark transition-colors shrink-0"
              aria-label={t('helpLink')}
            >
              <QuestionMarkCircle className="size-4" />
            </a>
          </Tooltip>
        </div>

        {!loading && !error && (
          <span className="text-sm font-medium text-emerald-400 dark:text-emerald-400 shrink-0">
            {t('percentUsed', { percent: percent.toFixed(1) })}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-8">
          <AlertCircle className="size-10 text-red-500 dark:text-red-400 mx-auto mb-3" />
          <p className="text-muted dark:text-muted-dark mb-4 text-sm">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 bg-accent dark:bg-accent-dark text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <p className="text-sm mb-4">
            <span
              className={
                overLimit
                  ? 'text-red-400 dark:text-red-400 font-medium'
                  : 'text-primary-text dark:text-primary-text-dark font-medium'
              }
            >
              {formatTransferBytes(usedBytes)}
            </span>
            <span className="text-muted dark:text-muted-dark"> {t('of')} </span>
            <span className="text-muted dark:text-muted-dark">
              {formatTransferBytes(limitBytes)}
            </span>
          </p>

          <div
            className="flex items-center gap-1"
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('title')}
          >
            {Array.from({ length: AIRLOCK_DOT_COUNT }, (_, index) => (
              <span
                key={index}
                className={`h-2 flex-1 rounded-full ${
                  index < filledDots ? dotColorClass : emptyDotColorClass
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

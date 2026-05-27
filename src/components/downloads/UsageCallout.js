'use client';

import { useTranslations, useLocale } from 'next-intl';
import Icons from '@/components/icons';
import { ABUSE_POLICY_URL } from '@/components/constants';
import { Link } from '@/i18n/navigation';
import { useBandwidthUsage } from '@/hooks/useBandwidthUsage';
import { formatSize } from './utils/formatters';

/**
 * @param {Object} props
 * @param {string} props.apiKey
 * @param {number|null|undefined} props.planId
 */
export default function UsageCallout({ apiKey, planId }) {
  const t = useTranslations('Usage');
  const locale = useLocale();
  const { level, usedBytes, limitBytes, percent, loading } = useBandwidthUsage(apiKey, planId);

  if (loading || !level || limitBytes == null || percent == null) {
    return null;
  }

  const isDanger = level === 'danger';
  const usedLabel = formatSize(usedBytes, locale);
  const limitLabel = formatSize(limitBytes, locale);
  const percentLabel = Math.round(percent);

  const message = isDanger
    ? t('danger.message', { used: usedLabel, limit: limitLabel, percent: percentLabel })
    : t('warning.message', { used: usedLabel, limit: limitLabel, percent: percentLabel });

  const title = isDanger ? t('danger.title') : t('warning.title');

  const barPercent = Math.min(percent, 100);

  return (
    <div
      role="status"
      className={
        isDanger
          ? 'mb-2 rounded-lg border border-label-danger-text/25 bg-label-danger-bg dark:bg-label-danger-bg-dark px-3 py-2'
          : 'mb-2 rounded-lg border border-label-warning-text/25 bg-label-warning-bg dark:bg-label-warning-bg-dark px-3 py-2'
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          {isDanger ? (
            <Icons.AlertCircle
              className="size-4 shrink-0 text-label-danger-text dark:text-label-danger-text-dark mt-0.5"
              aria-hidden
            />
          ) : (
            <Icons.ExclamationTriangle
              className="size-4 shrink-0 text-label-warning-text dark:text-label-warning-text-dark mt-0.5"
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <p
              className={
                isDanger
                  ? 'text-sm font-medium text-label-danger-text dark:text-label-danger-text-dark'
                  : 'text-sm font-medium text-label-warning-text dark:text-label-warning-text-dark'
              }
            >
              {title}
            </p>
            <p className="text-sm text-primary-text dark:text-primary-text-dark mt-0.5">
              {message}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pt-0.5">
          <Link href="/user" className="ui-btn-ghost !py-1.5 !px-3 !text-xs">
            {t('viewUsage')}
          </Link>
          <a
            href={ABUSE_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-btn-ghost !py-1.5 !px-3 !text-xs inline-flex items-center gap-1"
          >
            {t('learnMore')}
            <Icons.ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </div>
      <div
        className="mt-2 h-1.5 w-full rounded-full bg-border/40 dark:bg-border-dark/40 overflow-hidden"
        aria-hidden
      >
        <div
          className={
            isDanger
              ? 'h-full rounded-full bg-label-danger-text dark:bg-label-danger-text-dark transition-all'
              : 'h-full rounded-full bg-label-warning-text dark:bg-label-warning-text-dark transition-all'
          }
          style={{ width: `${barPercent}%` }}
        />
      </div>
    </div>
  );
}

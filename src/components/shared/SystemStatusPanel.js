'use client';

import { useTranslations } from 'next-intl';
import UptimeBar from '@/components/shared/UptimeBar';
import Icons from '@/components/icons';

const TORBOX_STATUS_PAGE_URL = 'https://status.torbox.app/';

function StatusCheckRow({ status, label, detail, responseTime, responseTimeLabel }) {
  const dotClass =
    status === 'healthy'
      ? 'bg-emerald-500'
      : status === 'invalid-key' || status === 'unhealthy'
        ? 'bg-red-500'
        : status === 'no-key'
          ? 'bg-zinc-500'
          : 'bg-amber-500';

  const StatusIcon =
    status === 'healthy'
      ? Icons.CheckCircle
      : status === 'invalid-key' || status === 'unhealthy'
        ? Icons.XCircle
        : Icons.QuestionMarkCircle;

  const iconClass =
    status === 'healthy'
      ? 'text-emerald-500 dark:text-emerald-400'
      : status === 'invalid-key' || status === 'unhealthy'
        ? 'text-red-500 dark:text-red-400'
        : 'text-zinc-400';

  return (
    <div className="flex items-center gap-2 py-2 border-b border-zinc-200/80 dark:border-zinc-700/80 last:border-0 min-w-0">
      <StatusIcon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
      <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{label}</p>
          {detail && (
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 break-words">{detail}</p>
          )}
        </div>
        {responseTime != null && responseTimeLabel && (
          <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
            {responseTimeLabel(responseTime)}
          </span>
        )}
      </div>
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
    </div>
  );
}

export default function SystemStatusPanel({
  apiKey,
  config,
  overallStatus,
  lastCheck,
  error,
  platformHealth,
  connectionHealth,
  showBackend,
  platformHistory,
  onRefresh,
}) {
  const t = useTranslations('SystemStatus');

  const formatLastCheck = (date) => {
    if (!date) return t('never');
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (seconds < 60) return t('justNow');
    if (minutes < 60) return t('minutesAgo', { minutes });
    return t('hoursAgo', { hours: Math.floor(minutes / 60) });
  };

  const rowLabel = (key) => t(`rows.${key}.label`);
  const rowStatus = (check) => {
    if (check.status === 'healthy') return t('rows.status.operational');
    if (check.status === 'invalid-key') return t('rows.status.invalidKey');
    if (check.status === 'no-key') return t('rows.status.notConfigured');
    if (check.status === 'unknown') return t('rows.status.checking');
    return check.message || t('rows.status.issue');
  };

  const formatMs = (ms) => t('responseTime', { ms });

  return (
    <>
      <div className="ui-dropdown-header !py-2.5 !px-3 shrink-0">
        <div className="flex items-start gap-2.5 mb-2 min-w-0">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${config.dotClass}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 break-words">
              {config.label}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <UptimeBar
            label={rowLabel('platform')}
            history={platformHistory}
            currentStatus={platformHealth.status}
          />

          {apiKey ? (
            <StatusCheckRow
              label={rowLabel('connection')}
              detail={rowStatus(connectionHealth)}
              status={connectionHealth.status}
              responseTime={connectionHealth.responseTime}
              responseTimeLabel={formatMs}
            />
          ) : (
            <StatusCheckRow
              label={rowLabel('connection')}
              detail={t('rows.status.notConfigured')}
              status="no-key"
            />
          )}

          {showBackend && (
            <StatusCheckRow
              label={rowLabel('backend')}
              detail={t('rows.status.operational')}
              status="healthy"
            />
          )}
        </div>

        {error && overallStatus !== 'healthy' && (
          <p className="mt-2 text-[11px] text-red-600 dark:text-red-400 leading-snug break-words">
            {error}
          </p>
        )}

        <p className="mt-2 text-[11px] text-zinc-500">{t('lastCheck')}: {formatLastCheck(lastCheck)}</p>
      </div>

      <div className="ui-dropdown-body !py-2 !px-3 shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <button
          type="button"
          onClick={onRefresh}
          className="text-left text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {t('refreshStatus')}
        </button>
        <a
          href={TORBOX_STATUS_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
        >
          {t('fullStatusPage')}
        </a>
      </div>
    </>
  );
}

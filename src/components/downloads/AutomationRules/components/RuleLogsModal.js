'use client';

import { useLocale } from 'next-intl';
import { parseUtcDate } from '@/utils/parseUtcDate';
import { ACTION_TYPES } from '../constants';
import LastEvaluatedAtValue from './LastEvaluatedAtValue';

function formatLogTimestamp(timestamp, locale) {
  try {
    if (!timestamp) {
      return 'Invalid Date';
    }
    const date = parseUtcDate(timestamp);
    return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString(locale);
  } catch {
    return timestamp || 'Invalid Date';
  }
}

function LogTimestamp({ timestamp }) {
  const locale = useLocale();
  return formatLogTimestamp(timestamp, locale);
}

/**
 * Get display name for action type
 * Converts action type (e.g., 'add_tag') to translation key (e.g., 'addTag')
 */
function getActionDisplayName(actionType, t) {
  if (!actionType) return 'Execution';

  // Convert action type to translation key format
  // e.g., 'add_tag' -> 'addTag', 'stop_seeding' -> 'stopSeeding'
  const translationKey = actionType
    .split('_')
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');

  // Try to get translation, fallback to formatted action type
  try {
    const translation = t(`actions.${translationKey}`);
    // If translation returns the key itself, it means translation doesn't exist
    if (translation === `actions.${translationKey}`) {
      // Fallback: format the action type nicely
      return actionType
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return translation;
  } catch (e) {
    // Fallback: format the action type nicely
    return actionType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export default function RuleLogsModal({
  ruleId,
  ruleName,
  logs,
  onClose,
  onClearLogs,
  lastEvaluatedAt,
  t,
  commonT,
}) {
  if (!ruleId) return null;

  return (
    <div className="fixed inset-0 bg-neutral-950/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg p-6 max-w-2xl w-full max-h-[70vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
              {t('ruleLogs')} - {ruleName}
            </h3>
            <div className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 mt-1">
              <strong>{t('lastRanAt') || 'Last ran at'}:</strong>{' '}
              {lastEvaluatedAt ? (
                <LastEvaluatedAtValue
                  at={lastEvaluatedAt}
                  commonT={commonT}
                  fallback={t('neverExecuted') || 'Never executed'}
                />
              ) : (
                t('neverExecuted') || 'Never executed'
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onClearLogs(ruleId)}
              className="px-3 py-1 text-sm bg-label-danger-text dark:bg-label-danger-text-dark text-white rounded-md hover:opacity-90 transition-colors"
            >
              {t('clearLogs')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
            >
              {t('close')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {logs?.length === 0 ? (
            <div className="text-center text-muted dark:text-muted-dark py-8">{t('noLogs')}</div>
          ) : (
            <div className="space-y-3">
              {logs?.map((log) => (
                <div
                  key={log.id}
                  className="p-3 border border-border dark:border-border-dark rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                      <LogTimestamp timestamp={log.timestamp} />
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        log.success
                          ? 'bg-label-success-bg text-label-success-text dark:bg-label-success-bg-dark dark:text-label-success-text-dark'
                          : 'bg-label-danger-bg text-label-danger-text dark:bg-label-danger-bg-dark dark:text-label-danger-text-dark'
                      }`}
                    >
                      {log.success ? t('success') : t('failed')}
                    </span>
                  </div>
                  <div className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                    {log.action && (
                      <div>
                        <strong>{t('action')}:</strong>{' '}
                        {log.actionType ? getActionDisplayName(log.actionType, t) : log.action}
                      </div>
                    )}
                    {log.itemsAffected > 0 && (
                      <div>
                        <strong>{t('itemsAffected')}:</strong> {log.itemsAffected}
                      </div>
                    )}
                    {log.details && (
                      <div>
                        <strong>{t('details')}:</strong> {log.details}
                      </div>
                    )}
                    {log.error && (
                      <div className="text-label-danger-text dark:text-label-danger-text-dark">
                        <strong>{t('error')}:</strong> {log.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

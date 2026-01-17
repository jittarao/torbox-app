'use client';

import { ACTION_TYPES } from '../constants';

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
}) {
  if (!ruleId) return null;

  // Format last evaluated at timestamp
  const formatLastEvaluatedAt = () => {
    if (!lastEvaluatedAt) return t('neverExecuted') || 'Never executed';
    try {
      const dateStr = lastEvaluatedAt;
      if (!dateStr) return t('neverExecuted') || 'Never executed';
      const date = new Date(dateStr.replace(' ', 'T'));
      return isNaN(date.getTime()) ? dateStr : date.toLocaleString();
    } catch (e) {
      return lastEvaluatedAt || t('neverExecuted') || 'Never executed';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-w-2xl w-full max-h-[70vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('ruleLogs')} - {ruleName}
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              <strong>{t('lastRanAt') || 'Last ran at'}:</strong> {formatLastEvaluatedAt()}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onClearLogs(ruleId)}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              {t('clearLogs')}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              {t('close')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {logs?.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">{t('noLogs')}</div>
          ) : (
            <div className="space-y-3">
              {logs?.map((log, index) => (
                <div
                  key={index}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {(() => {
                        try {
                          // Handle SQLite datetime format: "YYYY-MM-DD HH:MM:SS"
                          const dateStr = log.timestamp;
                          if (!dateStr) return 'Invalid Date';
                          // Replace space with 'T' to make it ISO-like, or parse directly
                          const date = new Date(dateStr.replace(' ', 'T'));
                          return isNaN(date.getTime()) ? dateStr : date.toLocaleString();
                        } catch (e) {
                          return log.timestamp || 'Invalid Date';
                        }
                      })()}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        log.success
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {log.success ? t('success') : t('failed')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
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
                      <div className="text-red-500 dark:text-red-400">
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

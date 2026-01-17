'use client';

import Icons from '@/components/icons';
import { getConditionText } from '../utils';
import { LOGIC_OPERATORS } from '../constants';

export default function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete,
  onViewLogs,
  onRun,
  isRunning,
  t,
  commonT,
}) {
  return (
    <div className="p-4 border border-border dark:border-border-dark rounded-lg">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={() => onToggle(rule.id)}
            className="w-4 h-4 accent-accent dark:accent-accent-dark"
          />
          <span className="text-primary-text dark:text-primary-text-dark font-medium">
            {rule.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRun && (
            <button
              onClick={() => onRun(rule.id)}
              disabled={isRunning}
              className="text-green-500 dark:text-green-400 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isRunning ? t('running') || 'Running...' : t('runRule') || 'Run rule'}
            >
              {isRunning ? (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <Icons.Play />
              )}
            </button>
          )}
          <button
            onClick={() => onViewLogs(rule.id)}
            className="text-blue-500 dark:text-blue-400 hover:opacity-80"
            title={t('viewLogs')}
          >
            <Icons.Clock />
          </button>
          <button
            onClick={() => onEdit(rule)}
            className="text-accent dark:text-accent-dark hover:opacity-80"
          >
            <Icons.Edit />
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="text-red-500 dark:text-red-500 hover:opacity-80"
          >
            <Icons.Delete />
          </button>
        </div>
      </div>
      <div className="mt-2 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        Every {rule.trigger?.value ?? 30} {commonT('minutes')}, if{' '}
        {(() => {
          // Rules always have groups structure (migrated in backend)
          const conditions = (rule.groups || []).flatMap((group) => group.conditions || []);
          const logicOperator = rule.logicOperator || LOGIC_OPERATORS.AND;
          return getConditionText(conditions, logicOperator, t, commonT);
        })()}
        , then {rule.action?.type?.replace('_', ' ') || 'unknown'}
      </div>
      {rule.last_evaluated_at && (
        <div className="mt-1 text-xs text-primary-text/50 dark:text-primary-text-dark/50">
          {t('lastRanAt') || 'Last ran at'}:{' '}
          {(() => {
            try {
              const dateStr = rule.last_evaluated_at;
              if (!dateStr) return t('neverExecuted') || 'Never executed';
              const date = new Date(dateStr.replace(' ', 'T'));
              return isNaN(date.getTime()) ? dateStr : date.toLocaleString();
            } catch (e) {
              return rule.last_evaluated_at || t('neverExecuted') || 'Never executed';
            }
          })()}
        </div>
      )}
    </div>
  );
}

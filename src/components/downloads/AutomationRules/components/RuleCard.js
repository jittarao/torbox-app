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
  t,
  commonT 
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
          const conditions = (rule.groups || []).flatMap(group => group.conditions || []);
          const logicOperator = rule.logicOperator || LOGIC_OPERATORS.AND;
          return getConditionText(conditions, logicOperator, t, commonT);
        })()}, then{' '}
        {rule.action?.type?.replace('_', ' ') || 'unknown'}
      </div>
    </div>
  );
}


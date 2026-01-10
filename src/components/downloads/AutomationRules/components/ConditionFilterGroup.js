'use client';

import { useState } from 'react';
import ConditionFilterInput from './ConditionFilterInput';
import { LOGIC_OPERATORS } from '../constants';
import Select from '@/components/shared/Select';
import { useTranslations } from 'next-intl';

export default function ConditionFilterGroup({
  group,
  groupIndex,
  totalGroups,
  onUpdateGroup,
  onRemoveGroup,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
  t,
  apiKey,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const automationRulesT = useTranslations('AutomationRules');

  const handleLogicChange = (newLogic) => {
    onUpdateGroup(groupIndex, 'logicOperator', newLogic);
  };

  const handleAddCondition = () => {
    onAddCondition(groupIndex);
  };

  const hasConditions = group.conditions && group.conditions.length > 0;

  return (
    <div className="border border-border dark:border-border-dark rounded-md bg-surface-alt dark:bg-surface-alt-dark">
      {/* Group Header */}
      <div className="flex items-center justify-between p-2 border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Group {groupIndex + 1}
          </button>

          {hasConditions && (
            <Select
              value={group.logicOperator || LOGIC_OPERATORS.AND}
              onChange={(e) => handleLogicChange(e.target.value)}
              className="min-w-[80px] text-xs"
            >
              <option value={LOGIC_OPERATORS.AND}>{automationRulesT('logicOperators.and')}</option>
              <option value={LOGIC_OPERATORS.OR}>{automationRulesT('logicOperators.or')}</option>
            </Select>
          )}

          {hasConditions && (
            <span className="text-xs text-primary-text/50 dark:text-primary-text-dark/50">
              ({group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isExpanded && (
            <button
              type="button"
              onClick={handleAddCondition}
              className="px-2 py-1 text-xs text-primary-text dark:text-primary-text-dark hover:bg-surface dark:hover:bg-surface-dark rounded transition-colors"
              title={automationRulesT('addConditionToGroup')}
            >
              + {automationRulesT('addCondition')}
            </button>
          )}

          {totalGroups > 1 && (
            <button
              type="button"
              onClick={() => onRemoveGroup(groupIndex)}
              className="px-2 py-1 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded transition-colors"
              title={automationRulesT('removeGroup')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Group Content */}
      {isExpanded && (
        <div className="p-2 space-y-2">
          {!hasConditions ? (
            <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70 italic py-2">
              {automationRulesT('noConditionsInGroup')}
            </p>
          ) : (
            <>
              {group.conditions.map((condition, conditionIndex) => (
                <div key={conditionIndex} className="relative">
                  {conditionIndex > 0 && (
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border dark:bg-border-dark -translate-y-2" />
                  )}
                  {conditionIndex > 0 && (
                    <div className="absolute left-4 -top-2 text-xs text-primary-text/50 dark:text-primary-text-dark/50 bg-surface-alt dark:bg-surface-alt-dark px-1">
                      {(group.logicOperator || LOGIC_OPERATORS.AND) === LOGIC_OPERATORS.AND ? automationRulesT('logicOperators.and') : automationRulesT('logicOperators.or')}
                    </div>
                  )}
                  <ConditionFilterInput
                    condition={condition}
                    index={conditionIndex}
                    totalConditions={group.conditions.length}
                    onUpdate={(idx, field, val) => onUpdateCondition(groupIndex, idx, field, val)}
                    onRemove={(idx) => onRemoveCondition(groupIndex, idx)}
                    t={t}
                    apiKey={apiKey}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

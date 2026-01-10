'use client';

import { 
  LOGIC_OPERATORS,
  ACTION_TYPES 
} from '../constants';
import ConditionFilterGroup from './ConditionFilterGroup';
import Select from '@/components/shared/Select';
import { useTranslations } from 'next-intl';

export default function RuleForm({ 
  rule, 
  onRuleChange,
  onSubmit, 
  onCancel, 
  onAddGroup,
  onRemoveGroup,
  onUpdateGroup,
  onAddCondition, 
  onRemoveCondition, 
  onUpdateCondition,
  editingRuleId,
  t,
  commonT,
  apiKey,
}) {
  // Rules always have groups structure (migrated in backend)
  const ruleGroups = rule.groups || [];
  const groupLogicOperator = rule.logicOperator || LOGIC_OPERATORS.AND;
  const automationRulesT = useTranslations('AutomationRules');
  return (
    <div className="mt-4 p-4 border border-border dark:border-border-dark rounded-lg">
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
            {t('ruleName')}
          </label>
          <input
            type="text"
            value={rule.name}
            onChange={(e) => onRuleChange({ ...rule, name: e.target.value })}
            className="w-full px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
            placeholder={t('ruleNamePlaceholder')}
          />
        </div>

        {/* Trigger */}
        <div>
          <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
            {t('checkEvery')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={rule.trigger.value}
              onChange={(e) =>
                onRuleChange({
                  ...rule,
                  trigger: {
                    ...rule.trigger,
                    value: parseInt(e.target.value) || 1,
                  },
                })
              }
              className="w-24 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
              min="1"
            />
            <span className="text-sm text-primary-text dark:text-primary-text-dark">
              {commonT('minutes')}
            </span>
          </div>
        </div>

        {/* Conditions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark">
              {t('condition')}
            </label>
            <button
              type="button"
              onClick={onAddGroup}
              className="text-xs text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80"
            >
              + Add Group
            </button>
          </div>

          {/* Logic Operator (only show if multiple groups) */}
          {ruleGroups.length > 1 && (
            <div className="w-64 mb-3">
              <Select
                value={groupLogicOperator}
                onChange={(e) =>
                  onRuleChange({
                    ...rule,
                    logicOperator: e.target.value,
                  })
                }
              >
                <option value={LOGIC_OPERATORS.AND}>{automationRulesT('logicOperators.andGroups')}</option>
                <option value={LOGIC_OPERATORS.OR}>{automationRulesT('logicOperators.orGroups')}</option>
              </Select>
            </div>
          )}

          {/* Condition Groups */}
          {ruleGroups.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 italic">
                {automationRulesT('noConditionGroups')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {ruleGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="relative">
                  {groupIndex > 0 && (
                    <div className="absolute left-0 right-0 -top-4 flex items-center justify-center z-10">
                      <div className="px-3 py-1 text-xs font-medium text-primary-text/70 dark:text-primary-text-dark/70 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-full shadow-sm">
                        {groupLogicOperator}
                      </div>
                    </div>
                  )}
                  <ConditionFilterGroup
                    group={group}
                    groupIndex={groupIndex}
                    totalGroups={ruleGroups.length}
                    onUpdateGroup={onUpdateGroup}
                    onRemoveGroup={onRemoveGroup}
                    onAddCondition={onAddCondition}
                    onUpdateCondition={onUpdateCondition}
                    onRemoveCondition={onRemoveCondition}
                    t={t}
                    apiKey={apiKey}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action */}
        <div>
          <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
            {t('action')}
          </label>
          <div className="w-48">
            <Select
              value={rule.action.type}
              onChange={(e) =>
                onRuleChange({
                  ...rule,
                  action: { type: e.target.value },
                })
              }
            >
              <option value={ACTION_TYPES.STOP_SEEDING} title={t('actions.stopSeedingDescription')}>
                {t('actions.stopSeeding')}
              </option>
              <option value={ACTION_TYPES.ARCHIVE} title={t('actions.archiveDescription')}>
                {t('actions.archive')}
              </option>
              <option value={ACTION_TYPES.DELETE} title={t('actions.deleteDescription')}>
                {t('actions.delete')}
              </option>
              <option value={ACTION_TYPES.FORCE_START} title={t('actions.forceStartDescription')}>
                {t('actions.forceStart')}
              </option>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={onSubmit}
            className="px-3 py-1.5 text-sm bg-accent dark:bg-accent-dark text-white rounded-md hover:bg-accent/90 dark:hover:bg-accent-dark/90 transition-colors"
          >
            {editingRuleId ? t('update') : t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}


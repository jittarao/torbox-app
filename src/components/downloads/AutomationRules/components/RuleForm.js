'use client';

import { 
  LOGIC_OPERATORS,
  ACTION_TYPES 
} from '../constants';
import ConditionInput from './ConditionInput';
import Select from '@/components/shared/Select';

export default function RuleForm({ 
  rule, 
  onRuleChange,
  onSubmit, 
  onCancel, 
  onAddCondition, 
  onRemoveCondition, 
  onUpdateCondition,
  editingRuleId,
  t,
  commonT 
}) {
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
              onClick={onAddCondition}
              className="text-xs text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80"
            >
              + Add Condition
            </button>
          </div>

          {/* Logic Operator (only show if multiple conditions) */}
          {rule.conditions.length > 1 && (
            <div className="w-64 mb-3">
              <Select
                value={rule.logicOperator}
                onChange={(e) =>
                  onRuleChange({
                    ...rule,
                    logicOperator: e.target.value,
                  })
                }
              >
                <option value={LOGIC_OPERATORS.AND}>ALL conditions (AND)</option>
                <option value={LOGIC_OPERATORS.OR}>ANY condition (OR)</option>
              </Select>
            </div>
          )}

          {/* Multiple Conditions */}
          {rule.conditions.map((condition, index) => (
            <ConditionInput
              key={index}
              condition={condition}
              index={index}
              totalConditions={rule.conditions.length}
              onUpdate={onUpdateCondition}
              onRemove={onRemoveCondition}
              t={t}
            />
          ))}
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


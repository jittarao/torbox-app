'use client';

import { CONDITION_TYPES, BOOLEAN_OPERATORS, TAG_OPERATORS } from '../constants';
import { isTagPresenceOperator } from '@/components/downloads/filters/tagFilterHelpers';
import {
  isBooleanCondition,
  isSpeedAverageCondition,
  getDefaultOperatorForConditionType,
  getDefaultValueForConditionType,
  getConditionTypeOptions,
} from '../utils';
import Select from '@/components/shared/Select';
import { useTags } from '@/components/shared/hooks/useTags';
import ConditionFilterValueInput from './ConditionFilterValueInput';
import { buildOperatorOptions } from './conditionFilterOperatorOptions';

export default function ConditionFilterInput({
  condition,
  index,
  totalConditions,
  onUpdate,
  onRemove,
  t,
  apiKey,
  assetTypes,
}) {
  const { tags } = useTags(apiKey);

  const handleFieldChange = (field, value) => {
    if (field === 'type') {
      const newOperator = getDefaultOperatorForConditionType(value);
      const newValue = getDefaultValueForConditionType(value);

      onUpdate(index, 'type', value);
      onUpdate(index, 'operator', newOperator);
      onUpdate(index, 'value', newValue);

      if (isSpeedAverageCondition(value)) {
        onUpdate(index, 'hours', 1);
      } else {
        onUpdate(index, 'hours', undefined);
      }
    } else if (field === 'value' && isBooleanCondition(condition.type)) {
      const boolValue = value === true || value === 'true' || value === 1;
      onUpdate(index, 'value', boolValue);
      onUpdate(
        index,
        'operator',
        boolValue ? BOOLEAN_OPERATORS.IS_TRUE : BOOLEAN_OPERATORS.IS_FALSE
      );
    } else if (field === 'type' && value === CONDITION_TYPES.TAGS) {
      onUpdate(index, 'type', value);
      onUpdate(index, 'operator', TAG_OPERATORS.IS_ANY_OF);
      onUpdate(index, 'value', []);
    } else if (field === 'operator' && condition.type === CONDITION_TYPES.TAGS) {
      onUpdate(index, 'operator', value);
      if (isTagPresenceOperator(value)) {
        onUpdate(index, 'value', []);
      }
    } else {
      onUpdate(index, field, value);
    }
  };

  const tagOptions = tags.map((tag) => ({
    label: tag.name,
    value: tag.id,
  }));

  const conditionTypeOptions = getConditionTypeOptions(t, assetTypes);
  const operatorOptions = buildOperatorOptions(condition, t);
  const showRemove = totalConditions > 1;

  return (
    <div
      className={`relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-surface-alt dark:bg-surface-alt-dark rounded-md border border-border dark:border-border-dark ${
        showRemove ? 'pr-10 sm:pr-2' : ''
      }`}
    >
      <Select
        value={String(condition.type || '')}
        onChange={(e) => {
          const newValue = e.target.value;
          if (newValue !== condition.type) {
            handleFieldChange('type', newValue);
          }
        }}
        className="w-full sm:min-w-[140px] sm:flex-1"
        searchable
        searchPlaceholder={t('searchConditionOptionsPlaceholder')}
        noMatchesMessage={t('searchConditionOptionsNoMatches')}
      >
        {conditionTypeOptions.map((group, groupIdx) => (
          <optgroup key={`group-${groupIdx}-${group.label}`} label={group.label}>
            {group.options.map((opt, optIdx) => (
              <option
                key={`opt-${groupIdx}-${optIdx}-${opt.value}`}
                value={String(opt.value)}
                title={opt.description}
              >
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>

      {condition.type && !isBooleanCondition(condition.type) && (
        <Select
          value={condition.operator || ''}
          onChange={(e) => handleFieldChange('operator', e.target.value)}
          className="w-full sm:min-w-[100px] sm:w-auto"
        >
          {operatorOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}

      {condition.type && isBooleanCondition(condition.type) && (
        <span className="text-sm text-primary-text dark:text-primary-text-dark px-2 whitespace-nowrap">
          is
        </span>
      )}

      <ConditionFilterValueInput
        condition={condition}
        onFieldChange={handleFieldChange}
        tagOptions={tagOptions}
        t={t}
      />

      {showRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute right-1.5 top-1.5 z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-base leading-none text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-400 dark:hover:bg-red-500/20 sm:static sm:size-auto sm:px-2 sm:py-1 sm:text-xs"
          title="Remove condition"
          aria-label="Remove condition"
        >
          ×
        </button>
      )}
    </div>
  );
}

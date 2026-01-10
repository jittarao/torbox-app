'use client';

import { 
  CONDITION_TYPES,
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
  TAG_OPERATORS,
} from '../constants';
import { useTags } from '@/components/shared/hooks/useTags';
import { 
  isTimeBasedCondition, 
  isTimestampBasedCondition,
  isBooleanCondition,
  isStringCondition,
  isSpeedAverageCondition,
  getConditionUnit,
  getOperatorsForConditionType,
  getDefaultOperatorForConditionType,
  getDefaultValueForConditionType,
  getFlatConditionTypeOptions,
} from '../utils';
import Select from '@/components/shared/Select';
import MultiSelect from '@/components/shared/MultiSelect';
import { STATUS_OPTIONS } from '@/components/constants';

// Map STATUS_OPTIONS labels to backend status values
const getStatusOptions = () => {
  return STATUS_OPTIONS
    .filter(opt => !opt.hidden && opt.label !== 'All' && opt.label !== 'Meta_DL' && opt.label !== 'Checking_Resume_Data')
    .map(opt => {
      const labelToValue = {
        'Queued': 'queued',
        'Downloading': 'downloading',
        'Seeding': 'seeding',
        'Completed': 'completed',
        'Uploading': 'uploading',
        'Stalled': 'stalled',
        'Inactive': 'inactive',
        'Failed': 'failed',
      };
      return {
        label: opt.label,
        value: labelToValue[opt.label] || opt.label.toLowerCase().replace(/\s+/g, '_'),
      };
    });
};

export default function ConditionFilterInput({ 
  condition, 
  index, 
  totalConditions,
  onUpdate, 
  onRemove,
  t,
  apiKey,
}) {
  const { tags } = useTags(apiKey);
  const handleFieldChange = (field, value) => {
    if (field === 'type') {
      // When changing condition type, update operator and value to appropriate defaults
      const newOperator = getDefaultOperatorForConditionType(value);
      const newValue = getDefaultValueForConditionType(value);
      
      onUpdate(index, 'type', value);
      onUpdate(index, 'operator', newOperator);
      onUpdate(index, 'value', newValue);
      
      // Initialize hours for speed average conditions
      if (isSpeedAverageCondition(value)) {
        onUpdate(index, 'hours', 1);
      } else {
        // Clear hours if not needed
        onUpdate(index, 'hours', undefined);
      }
    } else if (field === 'value' && isBooleanCondition(condition.type)) {
      // For boolean conditions, automatically update operator based on value
      const boolValue = value === true || value === 'true' || value === 1;
      onUpdate(index, 'value', boolValue);
      onUpdate(index, 'operator', boolValue ? BOOLEAN_OPERATORS.IS_TRUE : BOOLEAN_OPERATORS.IS_FALSE);
    } else if (field === 'type' && value === CONDITION_TYPES.TAGS) {
      // When changing to TAGS type, set default operator and value
      onUpdate(index, 'type', value);
      onUpdate(index, 'operator', TAG_OPERATORS.IS_ANY_OF);
      onUpdate(index, 'value', []);
    } else {
      onUpdate(index, field, value);
    }
  };

  // For STATUS condition, ensure value is an array
  const getStatusValue = () => {
    if (condition.type !== CONDITION_TYPES.STATUS) return condition.value;
    return Array.isArray(condition.value) ? condition.value : [];
  };

  // For TAGS condition, ensure value is an array of tag IDs
  const getTagsValue = () => {
    if (condition.type !== CONDITION_TYPES.TAGS) return condition.value;
    return Array.isArray(condition.value) ? condition.value : [];
  };

  // Get tag options for MultiSelect
  const getTagOptions = () => {
    return tags.map(tag => ({
      label: tag.name,
      value: tag.id,
    }));
  };

  const conditionTypeOptions = getFlatConditionTypeOptions(t);

  const operators = condition.type ? getOperatorsForConditionType(condition.type) : [];
  const operatorOptions = operators.map(op => {
    let label = op;
    const isTimeBased = isTimeBasedCondition(condition.type);
    const isTimestampBased = isTimestampBasedCondition(condition.type);

    if (isTimeBased || isTimestampBased || (!isBooleanCondition(condition.type) && !isStringCondition(condition.type) && condition.type !== CONDITION_TYPES.STATUS && condition.type !== CONDITION_TYPES.TAGS)) {
      // Numeric/time comparison operators
      const labels = {
        [COMPARISON_OPERATORS.GT]: t('operators.gt'),
        [COMPARISON_OPERATORS.LT]: t('operators.lt'),
        [COMPARISON_OPERATORS.GTE]: t('operators.gte'),
        [COMPARISON_OPERATORS.LTE]: t('operators.lte'),
        [COMPARISON_OPERATORS.EQ]: t('operators.eq'),
      };
      label = labels[op] || op;
    } else if (isStringCondition(condition.type)) {
      const labels = {
        [STRING_OPERATORS.EQUALS]: t('stringOperators.equals'),
        [STRING_OPERATORS.CONTAINS]: t('stringOperators.contains'),
        [STRING_OPERATORS.STARTS_WITH]: t('stringOperators.startsWith'),
        [STRING_OPERATORS.ENDS_WITH]: t('stringOperators.endsWith'),
        [STRING_OPERATORS.NOT_EQUALS]: t('stringOperators.notEquals'),
        [STRING_OPERATORS.NOT_CONTAINS]: t('stringOperators.notContains'),
      };
      label = labels[op] || op;
    } else if (isBooleanCondition(condition.type)) {
      const labels = {
        [BOOLEAN_OPERATORS.IS_TRUE]: t('booleanValues.true'),
        [BOOLEAN_OPERATORS.IS_FALSE]: t('booleanValues.false'),
      };
      label = labels[op] || op;
    } else if (condition.type === CONDITION_TYPES.STATUS) {
      const labels = {
        [MULTI_SELECT_OPERATORS.IS_ANY_OF]: t('multiSelectOperators.isAnyOf'),
        [MULTI_SELECT_OPERATORS.IS_NONE_OF]: t('multiSelectOperators.isNoneOf'),
      };
      label = labels[op] || op;
    } else if (condition.type === CONDITION_TYPES.TAGS) {
      const labels = {
        [TAG_OPERATORS.IS_ANY_OF]: t('tagOperators.isAnyOf'),
        [TAG_OPERATORS.IS_ALL_OF]: t('tagOperators.isAllOf'),
        [TAG_OPERATORS.IS_NONE_OF]: t('tagOperators.isNoneOf'),
      };
      label = labels[op] || op;
    }
    return { value: op, label };
  });

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-surface-alt dark:bg-surface-alt-dark rounded-md border border-border dark:border-border-dark">
      {/* Condition Type Selector */}
      <Select
        value={String(condition.type || '')}
        onChange={(e) => {
          const newValue = e.target.value;
          if (newValue !== condition.type) {
            handleFieldChange('type', newValue);
          }
        }}
        className="w-full sm:min-w-[140px] sm:flex-1"
      >
        <option value="">Select...</option>
        {conditionTypeOptions.map(opt => (
          <option key={opt.value} value={String(opt.value)} title={opt.description}>
            {opt.label}
          </option>
        ))}
      </Select>

      {/* Operator Selector - Hidden for boolean conditions */}
      {condition.type && !isBooleanCondition(condition.type) && (
        <Select
          value={condition.operator || ''}
          onChange={(e) => handleFieldChange('operator', e.target.value)}
          className="w-full sm:min-w-[100px] sm:w-auto"
        >
          {operatorOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}

      {/* "is" text for boolean conditions */}
      {condition.type && isBooleanCondition(condition.type) && (
        <span className="text-sm text-primary-text dark:text-primary-text-dark px-2 whitespace-nowrap">
          is
        </span>
      )}

      {/* Value Input */}
      {condition.type && (
        <>
          {condition.type === CONDITION_TYPES.STATUS ? (
            <MultiSelect
              value={getStatusValue()}
              onChange={(values) => handleFieldChange('value', values)}
              options={getStatusOptions()}
              placeholder={t('conditions.statusPlaceholder')}
              className="w-full sm:flex-1 sm:min-w-[150px]"
            />
          ) : condition.type === CONDITION_TYPES.TAGS ? (
            <MultiSelect
              value={getTagsValue()}
              onChange={(values) => handleFieldChange('value', values)}
              options={getTagOptions()}
              placeholder={t('conditions.tagsPlaceholder')}
              className="w-full sm:flex-1 sm:min-w-[150px]"
            />
          ) : isBooleanCondition(condition.type) ? (
            <Select
              value={condition.value === true || condition.value === 'true' || condition.value === 1 ? 'true' : 'false'}
              onChange={(e) => handleFieldChange('value', e.target.value === 'true')}
              className="w-full sm:min-w-[100px] sm:w-auto"
            >
              <option value="true">{t('booleanValues.true')}</option>
              <option value="false">{t('booleanValues.false')}</option>
            </Select>
          ) : isStringCondition(condition.type) ? (
            <input
              type="text"
              value={condition.value || ''}
              onChange={(e) => handleFieldChange('value', e.target.value)}
              placeholder={
                condition.type === CONDITION_TYPES.NAME
                  ? t('conditions.namePlaceholder')
                  : t('conditions.trackerPlaceholder')
              }
              className="w-full sm:flex-1 sm:min-w-[120px] px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
            />
          ) : (
            <div className="flex items-center gap-1 w-full sm:flex-1 sm:min-w-[120px]">
              <input
                type="number"
                value={condition.value ?? ''}
                onChange={(e) => handleFieldChange('value', parseFloat(e.target.value) || 0)}
                className="flex-1 min-w-0 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
                min="0"
                step={condition.type === CONDITION_TYPES.RATIO || condition.type === CONDITION_TYPES.AVAILABILITY ? '0.1' : '1'}
              />
              {getConditionUnit(condition.type) && (
                <span className="text-xs text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap flex-shrink-0">
                  {getConditionUnit(condition.type)}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Hours Input for Speed Average Conditions */}
      {condition.type && isSpeedAverageCondition(condition.type) && (
        <>
          <span className="text-sm text-primary-text dark:text-primary-text-dark whitespace-nowrap">
            {t('conditions.calculatedOver')}
          </span>
          <input
            type="number"
            value={condition.hours || 1}
            onChange={(e) => handleFieldChange('hours', Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
            min="1"
            max="24"
            step="1"
          />
          <span className="text-sm text-primary-text dark:text-primary-text-dark whitespace-nowrap">
            {t('conditions.hours')}
          </span>
        </>
      )}

      {/* Remove Button */}
      {totalConditions > 1 && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="px-2 py-1 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded transition-colors self-start sm:self-auto"
          title="Remove condition"
        >
          ×
        </button>
      )}
    </div>
  );
}

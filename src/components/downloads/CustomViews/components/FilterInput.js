'use client';

import { 
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
  TAG_OPERATORS,
} from '../../AutomationRules/constants';
import {
  isNumberColumn,
  isTextColumn,
  isTimestampColumn,
  isBooleanColumn,
  isStatusColumn,
  isTagsColumn,
  getOperatorsForColumn,
  getDefaultOperator,
  getDefaultValue,
  getColumnUnit,
  getGroupedFilterableColumns,
} from '../utils';
import { useTags } from '@/components/shared/hooks/useTags';
import Select from '@/components/shared/Select';
import MultiSelect from '@/components/shared/MultiSelect';
import { STATUS_OPTIONS } from '@/components/constants';
import { useTranslations } from 'next-intl';

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

// Get asset type options
const getAssetTypeOptions = () => {
  return [
    { label: 'Torrents', value: 'torrents' },
    { label: 'Usenet', value: 'usenet' },
    { label: 'Web Downloads', value: 'webdl' },
    { label: 'All', value: 'all' },
  ];
};

export default function FilterInput({ 
  filter, 
  index, 
  totalFilters,
  onUpdate, 
  onRemove,
  availableColumns,
  apiKey,
  activeType = 'all',
}) {
  const { tags } = useTags(apiKey);
  const customViewsT = useTranslations('CustomViews');
  const automationRulesT = useTranslations('AutomationRules');
  const columnT = useTranslations('Columns');

  const handleFieldChange = (field, value) => {
    if (field === 'column') {
      // When changing column, update operator and value to appropriate defaults
      const newOperator = getDefaultOperator(value);
      const newValue = getDefaultValue(value);
      // Update all three fields at once by calling onUpdate with a batch update
      // We'll update column first, then the parent will handle batching operator and value
      onUpdate(index, 'column', value);
      // Update operator and value immediately after
      onUpdate(index, 'operator', newOperator);
      onUpdate(index, 'value', newValue);
    } else if (field === 'value' && isBooleanColumn(filter.column)) {
      // For boolean conditions, automatically update operator based on value
      const boolValue = value === true || value === 'true' || value === 1;
      onUpdate(index, 'value', boolValue);
      onUpdate(index, 'operator', boolValue ? BOOLEAN_OPERATORS.IS_TRUE : BOOLEAN_OPERATORS.IS_FALSE);
    } else {
      onUpdate(index, field, value);
    }
  };

  // For STATUS condition, ensure value is an array
  const getStatusValue = () => {
    if (filter.column !== 'download_state' && filter.column !== 'asset_type') return filter.value;
    return Array.isArray(filter.value) ? filter.value : [];
  };

  // For TAGS condition, ensure value is an array of tag IDs
  const getTagsValue = () => {
    if (filter.column !== 'tags') return filter.value;
    return Array.isArray(filter.value) ? filter.value : [];
  };

  // Get tag options for MultiSelect
  const getTagOptions = () => {
    return tags.map(tag => ({
      label: tag.name,
      value: tag.id,
    }));
  };

  const columnGroups = getGroupedFilterableColumns(activeType, columnT, customViewsT);

  const operators = filter.column ? getOperatorsForColumn(filter.column) : [];
  const operatorOptions = operators.map(op => {
    let label = op;
    if (isNumberColumn(filter.column) || isTimestampColumn(filter.column)) {
      const labels = {
        [COMPARISON_OPERATORS.GT]: automationRulesT('operators.gt'),
        [COMPARISON_OPERATORS.LT]: automationRulesT('operators.lt'),
        [COMPARISON_OPERATORS.GTE]: automationRulesT('operators.gte'),
        [COMPARISON_OPERATORS.LTE]: automationRulesT('operators.lte'),
        [COMPARISON_OPERATORS.EQ]: automationRulesT('operators.eq'),
      };
      label = labels[op] || op;
    } else if (isTextColumn(filter.column)) {
      const labels = {
        [STRING_OPERATORS.EQUALS]: automationRulesT('stringOperators.equals'),
        [STRING_OPERATORS.CONTAINS]: automationRulesT('stringOperators.contains'),
        [STRING_OPERATORS.STARTS_WITH]: automationRulesT('stringOperators.startsWith'),
        [STRING_OPERATORS.ENDS_WITH]: automationRulesT('stringOperators.endsWith'),
        [STRING_OPERATORS.NOT_EQUALS]: automationRulesT('stringOperators.notEquals'),
        [STRING_OPERATORS.NOT_CONTAINS]: automationRulesT('stringOperators.notContains'),
      };
      label = labels[op] || op;
    } else if (isBooleanColumn(filter.column)) {
      const labels = {
        [BOOLEAN_OPERATORS.IS_TRUE]: automationRulesT('booleanValues.true'),
        [BOOLEAN_OPERATORS.IS_FALSE]: automationRulesT('booleanValues.false'),
      };
      label = labels[op] || op;
    } else if (isStatusColumn(filter.column)) {
      const labels = {
        [MULTI_SELECT_OPERATORS.IS_ANY_OF]: automationRulesT('multiSelectOperators.isAnyOf'),
        [MULTI_SELECT_OPERATORS.IS_NONE_OF]: automationRulesT('multiSelectOperators.isNoneOf'),
      };
      label = labels[op] || op;
    } else if (isTagsColumn(filter.column)) {
      const labels = {
        [TAG_OPERATORS.IS_ANY_OF]: automationRulesT('tagOperators.isAnyOf'),
        [TAG_OPERATORS.IS_ALL_OF]: automationRulesT('tagOperators.isAllOf'),
        [TAG_OPERATORS.IS_NONE_OF]: automationRulesT('tagOperators.isNoneOf'),
      };
      label = labels[op] || op;
    }
    return { value: op, label };
  });

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-surface-alt dark:bg-surface-alt-dark rounded-md border border-border dark:border-border-dark">
      {/* Column Selector */}
      <Select
        value={String(filter.column || '')}
        onChange={(e) => {
          const newValue = e.target.value;
          if (newValue !== filter.column) {
            handleFieldChange('column', newValue);
          }
        }}
        className="w-full sm:min-w-[120px] sm:flex-1"
      >
        {columnGroups.map((group, groupIdx) => (
          <optgroup key={`group-${groupIdx}-${group.label}`} label={group.label}>
            {group.options.map((opt, optIdx) => (
              <option 
                key={`col-${groupIdx}-${optIdx}-${opt.value}`} 
                value={String(opt.value)}
              >
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>

      {/* Operator Selector - Hidden for boolean conditions */}
      {filter.column && !isBooleanColumn(filter.column) && (
        <Select
          value={filter.operator || ''}
          onChange={(e) => handleFieldChange('operator', e.target.value)}
          className="w-full sm:min-w-[100px] sm:w-auto"
        >
          {operatorOptions.map((opt, idx) => (
            <option key={`op-${idx}-${opt.value}`} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}

      {/* "is" text for boolean conditions */}
      {filter.column && isBooleanColumn(filter.column) && (
        <span className="text-sm text-primary-text dark:text-primary-text-dark px-2 whitespace-nowrap">
          is
        </span>
      )}

      {/* Value Input */}
      {filter.column && (
        <>
          {filter.column === 'download_state' || filter.column === 'asset_type' ? (
            <MultiSelect
              value={getStatusValue()}
              onChange={(values) => handleFieldChange('value', values)}
              options={filter.column === 'download_state' ? getStatusOptions() : getAssetTypeOptions()}
              placeholder={customViewsT('selectPlaceholder')}
              className="w-full sm:flex-1 sm:min-w-[150px]"
            />
          ) : filter.column === 'tags' ? (
            <MultiSelect
              value={getTagsValue()}
              onChange={(values) => handleFieldChange('value', values)}
              options={getTagOptions()}
              placeholder={customViewsT('selectTagsPlaceholder')}
              className="w-full sm:flex-1 sm:min-w-[150px]"
            />
          ) : isBooleanColumn(filter.column) ? (
            <Select
              value={filter.value === true || filter.value === 'true' || filter.value === 1 ? 'true' : 'false'}
              onChange={(e) => handleFieldChange('value', e.target.value === 'true')}
              className="w-full sm:min-w-[100px] sm:w-auto"
            >
              <option value="true">{automationRulesT('booleanValues.true')}</option>
              <option value="false">{automationRulesT('booleanValues.false')}</option>
            </Select>
          ) : isTextColumn(filter.column) ? (
            <input
              type="text"
              value={filter.value || ''}
              onChange={(e) => handleFieldChange('value', e.target.value)}
              placeholder={customViewsT('enterValuePlaceholder')}
              className="w-full sm:flex-1 sm:min-w-[120px] px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
            />
          ) : (
            <div className="flex items-center gap-1 w-full sm:flex-1 sm:min-w-[120px]">
              <input
                type="number"
                value={filter.value ?? ''}
                onChange={(e) => handleFieldChange('value', parseFloat(e.target.value) || 0)}
                className="flex-1 min-w-0 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
                min="0"
                step={filter.column === 'ratio' ? '0.1' : '1'}
              />
              {getColumnUnit(filter.column) && (
                <span className="text-xs text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap flex-shrink-0">
                  {getColumnUnit(filter.column)}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Remove Button */}
      {totalFilters > 1 && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="px-2 py-1 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded transition-colors self-start sm:self-auto"
          title="Remove filter"
        >
          ×
        </button>
      )}
    </div>
  );
}

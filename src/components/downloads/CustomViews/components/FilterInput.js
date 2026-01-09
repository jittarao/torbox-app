'use client';

import { 
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
} from '../../AutomationRules/constants';
import {
  isNumberColumn,
  isTextColumn,
  isTimestampColumn,
  isBooleanColumn,
  isStatusColumn,
  getOperatorsForColumn,
  getDefaultOperator,
  getDefaultValue,
  getColumnUnit,
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
}) {
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

  const columnOptions = availableColumns.map(col => ({
    value: col.key,
    label: col.label,
  }));

  const operators = filter.column ? getOperatorsForColumn(filter.column) : [];
  const operatorOptions = operators.map(op => {
    let label = op;
    if (isNumberColumn(filter.column) || isTimestampColumn(filter.column)) {
      const labels = {
        [COMPARISON_OPERATORS.GT]: '>',
        [COMPARISON_OPERATORS.LT]: '<',
        [COMPARISON_OPERATORS.GTE]: '≥',
        [COMPARISON_OPERATORS.LTE]: '≤',
        [COMPARISON_OPERATORS.EQ]: '=',
      };
      label = labels[op] || op;
    } else if (isTextColumn(filter.column)) {
      const labels = {
        [STRING_OPERATORS.EQUALS]: 'equals',
        [STRING_OPERATORS.CONTAINS]: 'contains',
        [STRING_OPERATORS.STARTS_WITH]: 'starts with',
        [STRING_OPERATORS.ENDS_WITH]: 'ends with',
        [STRING_OPERATORS.NOT_EQUALS]: 'not equals',
        [STRING_OPERATORS.NOT_CONTAINS]: 'not contains',
      };
      label = labels[op] || op;
    } else if (isBooleanColumn(filter.column)) {
      const labels = {
        [BOOLEAN_OPERATORS.IS_TRUE]: 'is true',
        [BOOLEAN_OPERATORS.IS_FALSE]: 'is false',
      };
      label = labels[op] || op;
    } else if (isStatusColumn(filter.column)) {
      const labels = {
        [MULTI_SELECT_OPERATORS.IS_ANY_OF]: 'is any of',
        [MULTI_SELECT_OPERATORS.IS_NONE_OF]: 'is none of',
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
        <option value="">Select...</option>
        {columnOptions.map(opt => (
          <option key={opt.value} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </Select>

      {/* Operator Selector - Hidden for boolean conditions */}
      {filter.column && !isBooleanColumn(filter.column) && (
        <Select
          value={filter.operator || ''}
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
              placeholder="Select..."
              className="w-full sm:flex-1 sm:min-w-[150px]"
            />
          ) : isBooleanColumn(filter.column) ? (
            <Select
              value={filter.value === true || filter.value === 'true' || filter.value === 1 ? 'true' : 'false'}
              onChange={(e) => handleFieldChange('value', e.target.value === 'true')}
              className="w-full sm:min-w-[100px] sm:w-auto"
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </Select>
          ) : isTextColumn(filter.column) ? (
            <input
              type="text"
              value={filter.value || ''}
              onChange={(e) => handleFieldChange('value', e.target.value)}
              placeholder="Enter value..."
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

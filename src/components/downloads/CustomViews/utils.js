import { COLUMNS } from '@/components/constants';
import {
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
  TAG_OPERATORS,
} from '../AutomationRules/constants';
import {
  getGroupedFilterFields,
  getColumnUnit as getRegistryColumnUnit,
  getColumnValueKind,
  getFieldByColumnKey,
} from '../filters/filterFieldRegistry';

/** Tag operators shown in custom view filters (aligned with automation). */
export const VIEW_TAG_FILTER_OPERATORS = [
  TAG_OPERATORS.IS_ANY_OF,
  TAG_OPERATORS.IS_ALL_OF,
  TAG_OPERATORS.IS_NONE_OF,
  TAG_OPERATORS.IS_SET,
  TAG_OPERATORS.IS_NOT_SET,
];

const getColumnFilterType = (columnKey) => getColumnValueKind(columnKey);

export const isNumberColumn = (columnKey) => getColumnFilterType(columnKey) === 'number';

export const isTextColumn = (columnKey) => getColumnFilterType(columnKey) === 'text';

export const isTimestampColumn = (columnKey) => getColumnFilterType(columnKey) === 'timestamp';

export const isTimeColumn = (columnKey) => getColumnFilterType(columnKey) === 'time';

export const isBooleanColumn = (columnKey) => getColumnFilterType(columnKey) === 'boolean';

export const isStatusColumn = (columnKey) => getColumnFilterType(columnKey) === 'status';

export const isTagsColumn = (columnKey) => getColumnFilterType(columnKey) === 'tags';

export const getOperatorsForColumn = (columnKey) => {
  const filterType = getColumnFilterType(columnKey);

  switch (filterType) {
    case 'number':
    case 'time':
      return Object.values(COMPARISON_OPERATORS);
    case 'text':
      return Object.values(STRING_OPERATORS);
    case 'timestamp':
      return Object.values(COMPARISON_OPERATORS);
    case 'boolean':
      return Object.values(BOOLEAN_OPERATORS);
    case 'status':
      return Object.values(MULTI_SELECT_OPERATORS);
    case 'tags':
      return VIEW_TAG_FILTER_OPERATORS;
    default:
      return Object.values(COMPARISON_OPERATORS);
  }
};

export const getDefaultOperator = (columnKey) => {
  const filterType = getColumnFilterType(columnKey);

  switch (filterType) {
    case 'number':
    case 'time':
      return COMPARISON_OPERATORS.GT;
    case 'text':
      return STRING_OPERATORS.CONTAINS;
    case 'timestamp':
      return COMPARISON_OPERATORS.GT;
    case 'boolean':
      return BOOLEAN_OPERATORS.IS_TRUE;
    case 'status':
      return MULTI_SELECT_OPERATORS.IS_ANY_OF;
    case 'tags':
      return MULTI_SELECT_OPERATORS.IS_ANY_OF;
    default:
      return COMPARISON_OPERATORS.GT;
  }
};

export const getDefaultValue = (columnKey) => {
  const filterType = getColumnFilterType(columnKey);

  switch (filterType) {
    case 'number':
    case 'time':
      return 0;
    case 'text':
      return '';
    case 'timestamp':
      return 0;
    case 'boolean':
      return true;
    case 'status':
      return [];
    case 'tags':
      return [];
    default:
      return 0;
  }
};

export const getFilterableColumns = (columnT, activeType = 'all') => {
  const columnKeysToExclude = ['id', 'hash', 'download_progress'];

  const baseColumns = Object.entries(COLUMNS).reduce((acc, [key, column]) => {
    if (columnKeysToExclude.includes(key)) return acc;
    if (!getFieldByColumnKey(key)) return acc;
    acc.push({
      key,
      label:
        key === 'airlocked'
          ? columnT('airlocked_filter')
          : key === 'is_protected'
            ? columnT('is_protected_filter')
            : column.displayName
              ? column.displayName
              : columnT(key),
      ...column,
    });
    return acc;
  }, []);

  if (getFieldByColumnKey('tags')) {
    baseColumns.push({
      key: 'tags',
      label: 'Tags',
      sortable: false,
    });
  }

  return baseColumns;
};

export const getGroupedFilterableColumns = (
  activeType = 'all',
  columnT,
  customViewsT,
  automationT
) => {
  return getGroupedFilterFields('customView', {
    activeType,
    columnT,
    customViewsT,
    automationT,
  });
};

export const getColumnUnit = (columnKey) => getRegistryColumnUnit(columnKey);

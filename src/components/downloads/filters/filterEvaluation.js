import { getMatchingStatus } from '@/components/downloads/ActionBar/utils/statusHelpers';
import {
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
  LOGIC_OPERATORS,
  TAG_OPERATORS,
} from '@/components/downloads/AutomationRules/constants';
import {
  isNumberColumn,
  isTextColumn,
  isTimestampColumn,
  isTimeColumn,
  isBooleanColumn,
  isStatusColumn,
  isTagsColumn,
} from '@/components/downloads/CustomViews/utils';
import {
  getItemFieldForColumn,
  getValueConversion,
} from '@/components/downloads/filters/filterFieldRegistry';
import { getItemFileCount } from '@/utils/downloadEntityFiles';
import {
  extractSourceHost,
  normalizeSourceHostKey,
} from '@/components/downloads/filters/sourceDisplay';

const BYTES_PER_GB = 1024 * 1024 * 1024;
const BYTES_PER_MB = 1024 * 1024;
const BYTES_PER_SECOND_TO_MBPS = 1 / (1024 * 1024);

function matchesOriginalUrlEquals(columnValue, filterValue) {
  const strFilter = String(filterValue || '').toLowerCase();
  if (!strFilter) return false;

  const strValue = String(columnValue || '');
  if (!strValue) return false;

  if (strFilter.includes('://')) {
    return strValue.toLowerCase() === strFilter;
  }

  return (
    extractSourceHost(strValue).toLowerCase() === normalizeSourceHostKey(filterValue).toLowerCase()
  );
}

function compareNumeric(operator, itemValue, filterValue) {
  switch (operator) {
    case COMPARISON_OPERATORS.GT:
      return itemValue > filterValue;
    case COMPARISON_OPERATORS.LT:
      return itemValue < filterValue;
    case COMPARISON_OPERATORS.GTE:
      return itemValue >= filterValue;
    case COMPARISON_OPERATORS.LTE:
      return itemValue <= filterValue;
    case COMPARISON_OPERATORS.EQ:
      return itemValue === filterValue;
    default:
      return true;
  }
}

function getNumericItemValue(columnKey, rawValue) {
  const conversion = getValueConversion(columnKey);

  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  let numValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
  if (Number.isNaN(numValue)) numValue = 0;

  switch (conversion) {
    case 'bytesToGb':
      return numValue / BYTES_PER_GB;
    case 'bytesToMb':
      return numValue / BYTES_PER_MB;
    case 'mbps':
      return numValue * BYTES_PER_SECOND_TO_MBPS;
    case 'secondsToMinutes':
      return numValue / 60;
    case 'percent':
      return numValue * 100;
    default:
      return numValue;
  }
}

function getNumericFilterValue(columnKey, filterValue) {
  const conversion = getValueConversion(columnKey);
  let numFilter = typeof filterValue === 'number' ? filterValue : parseFloat(filterValue);
  if (Number.isNaN(numFilter)) numFilter = 0;

  if (conversion === 'percent') {
    return numFilter;
  }

  return numFilter;
}

function getTimeItemValue(columnKey, rawValue) {
  if (!rawValue) return null;

  const itemTime = new Date(rawValue).getTime();
  if (Number.isNaN(itemTime)) return null;

  const now = Date.now();
  const conversion = getValueConversion(columnKey);

  if (conversion === 'hoursSinceCreated' || conversion === 'hoursSinceCached') {
    return (now - itemTime) / (1000 * 60 * 60);
  }

  return null;
}

function getTimestampItemValue(columnKey, rawValue) {
  if (!rawValue) return null;

  const itemTime = new Date(rawValue).getTime();
  if (Number.isNaN(itemTime)) return null;

  const now = Date.now();
  const conversion = getValueConversion(columnKey);

  if (conversion === 'hoursUntil') {
    return (itemTime - now) / (1000 * 60 * 60);
  }

  return null;
}

/** Evaluate a single filter condition against an item. */
function evaluateFilter(filter, item) {
  if (!filter.column || filter.operator === undefined) return true;

  const columnKey = filter.column;
  const itemField = getItemFieldForColumn(columnKey);
  const columnValue =
    columnKey === 'file_count' ? getItemFileCount(item) : (item[itemField] ?? item[columnKey]);
  const operator = filter.operator;
  const filterValue = filter.value;

  if (
    columnKey !== 'download_state' &&
    columnKey !== 'asset_type' &&
    columnKey !== 'is_downloaded' &&
    columnKey !== 'airlocked' &&
    columnKey !== 'is_protected' &&
    columnKey !== 'tags' &&
    columnKey !== 'active' &&
    columnKey !== 'long_term_seeding' &&
    (columnValue === null || columnValue === undefined)
  ) {
    return false;
  }

  if (isNumberColumn(columnKey)) {
    const itemValue = getNumericItemValue(columnKey, columnValue);
    if (itemValue === null) return false;

    const numFilter = getNumericFilterValue(columnKey, filterValue);
    return compareNumeric(operator, itemValue, numFilter);
  }

  if (isTimeColumn(columnKey)) {
    const itemValue = getTimeItemValue(columnKey, columnValue);
    if (itemValue === null) return false;

    const numFilter = getNumericFilterValue(columnKey, filterValue);
    return compareNumeric(operator, itemValue, numFilter);
  }

  if (isTextColumn(columnKey)) {
    const strValue = String(columnValue || '').toLowerCase();
    const strFilter = String(filterValue || '').toLowerCase();

    switch (operator) {
      case STRING_OPERATORS.EQUALS:
        if (columnKey === 'original_url') {
          return matchesOriginalUrlEquals(columnValue, filterValue);
        }
        return strValue === strFilter;
      case STRING_OPERATORS.CONTAINS:
        return strValue.includes(strFilter);
      case STRING_OPERATORS.STARTS_WITH:
        return strValue.startsWith(strFilter);
      case STRING_OPERATORS.ENDS_WITH:
        return strValue.endsWith(strFilter);
      case STRING_OPERATORS.NOT_EQUALS:
        return strValue !== strFilter;
      case STRING_OPERATORS.NOT_CONTAINS:
        return !strValue.includes(strFilter);
      default:
        return true;
    }
  }

  if (isTimestampColumn(columnKey)) {
    const compareValue = getTimestampItemValue(columnKey, columnValue);
    if (compareValue === null) return false;

    const filterAmount =
      typeof filterValue === 'number' ? filterValue : parseFloat(filterValue) || 0;

    switch (operator) {
      case COMPARISON_OPERATORS.GT:
        return compareValue > filterAmount;
      case COMPARISON_OPERATORS.LT:
        return compareValue < filterAmount;
      case COMPARISON_OPERATORS.GTE:
        return compareValue >= filterAmount;
      case COMPARISON_OPERATORS.LTE:
        return compareValue <= filterAmount;
      case COMPARISON_OPERATORS.EQ:
        return Math.abs(compareValue - filterAmount) < 1;
      default:
        return true;
    }
  }

  if (isBooleanColumn(columnKey)) {
    const boolValue = columnValue === true || columnValue === 1 || columnValue === 'true';

    switch (operator) {
      case BOOLEAN_OPERATORS.IS_TRUE:
        return boolValue === true;
      case BOOLEAN_OPERATORS.IS_FALSE:
        return boolValue === false;
      default:
        return true;
    }
  }

  if (isStatusColumn(columnKey)) {
    if (columnKey === 'download_state') {
      const itemStatus = getMatchingStatus(item);
      const itemStatusLabel = itemStatus?.label?.toLowerCase() || '';

      const filterValues = Array.isArray(filterValue)
        ? filterValue.map((v) => String(v).toLowerCase())
        : [];

      switch (operator) {
        case MULTI_SELECT_OPERATORS.IS_ANY_OF:
          if (filterValues.length === 0) return true;
          return filterValues.some((fv) => itemStatusLabel === fv);
        case MULTI_SELECT_OPERATORS.IS_NONE_OF:
          if (filterValues.length === 0) return true;
          return !filterValues.some((fv) => itemStatusLabel === fv);
        default:
          return true;
      }
    } else if (columnKey === 'asset_type') {
      const itemValue = String(item.assetType || item.asset_type || '').toLowerCase();
      const filterValues = Array.isArray(filterValue)
        ? filterValue.map((v) => String(v).toLowerCase())
        : [];

      switch (operator) {
        case MULTI_SELECT_OPERATORS.IS_ANY_OF:
          if (filterValues.length === 0) return true;
          return filterValues.includes(itemValue);
        case MULTI_SELECT_OPERATORS.IS_NONE_OF:
          if (filterValues.length === 0) return true;
          return !filterValues.includes(itemValue);
        default:
          return true;
      }
    }
  }

  if (isTagsColumn(columnKey)) {
    const itemTags = item.tags || [];
    const itemTagIds = itemTags.map((tag) => tag.id);
    const filterTagIds = Array.isArray(filterValue)
      ? filterValue.reduce((acc, v) => {
          const id = typeof v === 'number' ? v : parseInt(v, 10);
          if (!isNaN(id)) acc.push(id);
          return acc;
        }, [])
      : [];

    switch (operator) {
      case TAG_OPERATORS.IS_ANY_OF:
      case MULTI_SELECT_OPERATORS.IS_ANY_OF:
        if (filterTagIds.length === 0) return true;
        return filterTagIds.some((tagId) => itemTagIds.includes(tagId));
      case TAG_OPERATORS.IS_NONE_OF:
      case MULTI_SELECT_OPERATORS.IS_NONE_OF:
        if (filterTagIds.length === 0) return true;
        return !filterTagIds.some((tagId) => itemTagIds.includes(tagId));
      case TAG_OPERATORS.IS_ALL_OF:
        if (filterTagIds.length === 0) return true;
        return filterTagIds.every((tagId) => itemTagIds.includes(tagId));
      case TAG_OPERATORS.IS_SET:
        return itemTagIds.length > 0;
      case TAG_OPERATORS.IS_NOT_SET:
        return itemTagIds.length === 0;
      default:
        return true;
    }
  }

  return true;
}

/** Whether an item matches column filter groups (same logic as useFilter, without search/status). */
export function itemMatchesFilters(item, filters) {
  if (!filters || typeof filters !== 'object') return true;

  if (filters.groups && Array.isArray(filters.groups)) {
    const groupLogic = filters.logicOperator || LOGIC_OPERATORS.AND;

    const groupResults = filters.groups.map((group) => {
      const groupLogicOp = group.logicOperator || LOGIC_OPERATORS.AND;
      const groupFilters = group.filters || [];

      if (groupFilters.length === 0) return true;

      const filterResults = groupFilters.reduce((acc, f) => {
        if (f.column) acc.push(evaluateFilter(f, item));
        return acc;
      }, []);

      if (filterResults.length === 0) return true;

      if (groupLogicOp === LOGIC_OPERATORS.OR) {
        return filterResults.some((result) => result === true);
      }
      return filterResults.every((result) => result === true);
    });

    if (groupResults.length === 0) return true;
    if (groupLogic === LOGIC_OPERATORS.OR) {
      return groupResults.some((result) => result === true);
    }
    return groupResults.every((result) => result === true);
  }

  if (Array.isArray(filters)) {
    return filters.length === 0 || filters.every((filter) => evaluateFilter(filter, item));
  }

  return true;
}

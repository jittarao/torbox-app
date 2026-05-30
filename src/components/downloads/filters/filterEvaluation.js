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
  isBooleanColumn,
  isStatusColumn,
  isTagsColumn,
} from '@/components/downloads/CustomViews/utils';
/** Evaluate a single filter condition against an item. */
function evaluateFilter(filter, item) {
  if (!filter.column || filter.operator === undefined) return true;

  const columnValue = item[filter.column];
  const operator = filter.operator;
  const filterValue = filter.value;

  if (
    filter.column !== 'download_state' &&
    filter.column !== 'asset_type' &&
    filter.column !== 'is_downloaded' &&
    filter.column !== 'tags' &&
    (columnValue === null || columnValue === undefined)
  ) {
    return false;
  }

  if (isNumberColumn(filter.column)) {
    let numValue = typeof columnValue === 'number' ? columnValue : parseFloat(columnValue) || 0;
    let numFilter = typeof filterValue === 'number' ? filterValue : parseFloat(filterValue) || 0;

    if (filter.column === 'progress') {
      numFilter = numFilter / 100;
    }

    if (
      filter.column === 'size' ||
      filter.column === 'total_uploaded' ||
      filter.column === 'total_downloaded'
    ) {
      numFilter = numFilter * 1024 * 1024;
    }

    switch (operator) {
      case COMPARISON_OPERATORS.GT:
        return numValue > numFilter;
      case COMPARISON_OPERATORS.LT:
        return numValue < numFilter;
      case COMPARISON_OPERATORS.GTE:
        return numValue >= numFilter;
      case COMPARISON_OPERATORS.LTE:
        return numValue <= numFilter;
      case COMPARISON_OPERATORS.EQ:
        return numValue === numFilter;
      default:
        return true;
    }
  }

  if (isTextColumn(filter.column)) {
    const strValue = String(columnValue || '').toLowerCase();
    const strFilter = String(filterValue || '').toLowerCase();

    switch (operator) {
      case STRING_OPERATORS.EQUALS:
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

  if (isTimestampColumn(filter.column)) {
    if (!columnValue) return false;

    const itemTime = new Date(columnValue).getTime();
    if (isNaN(itemTime)) return false;

    const now = Date.now();
    const diffMs = now - itemTime;
    const diffMinutes = diffMs / (1000 * 60);

    const filterDays = typeof filterValue === 'number' ? filterValue : parseFloat(filterValue) || 0;
    const filterMinutes = filterDays * 24 * 60;

    switch (operator) {
      case COMPARISON_OPERATORS.GT:
        return diffMinutes > filterMinutes;
      case COMPARISON_OPERATORS.LT:
        return diffMinutes < filterMinutes;
      case COMPARISON_OPERATORS.GTE:
        return diffMinutes >= filterMinutes;
      case COMPARISON_OPERATORS.LTE:
        return diffMinutes <= filterMinutes;
      case COMPARISON_OPERATORS.EQ:
        return Math.abs(diffMinutes - filterMinutes) < 24 * 60;
      default:
        return true;
    }
  }

  if (isBooleanColumn(filter.column)) {
    const boolValue = columnValue === true || columnValue === 1 || columnValue === 'true';
    const boolFilter = filterValue === true || filterValue === 1 || filterValue === 'true';

    switch (operator) {
      case BOOLEAN_OPERATORS.IS_TRUE:
        return boolValue === true;
      case BOOLEAN_OPERATORS.IS_FALSE:
        return boolValue === false;
      default:
        return true;
    }
  }

  if (isStatusColumn(filter.column)) {
    if (filter.column === 'download_state') {
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
    } else if (filter.column === 'asset_type') {
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

  if (isTagsColumn(filter.column)) {
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

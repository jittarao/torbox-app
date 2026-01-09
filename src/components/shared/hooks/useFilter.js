'use client';

import { useState, useMemo, useEffect } from 'react';
import { getMatchingStatus } from '@/components/downloads/ActionBar/utils/statusHelpers';
import {
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
  LOGIC_OPERATORS,
} from '@/components/downloads/AutomationRules/constants';
import {
  isNumberColumn,
  isTextColumn,
  isTimestampColumn,
  isBooleanColumn,
  isStatusColumn,
} from '@/components/downloads/CustomViews/utils';

// Evaluate a single filter condition against an item
const evaluateFilter = (filter, item) => {
  if (!filter.column || filter.operator === undefined) return true;

  const columnValue = item[filter.column];
  const operator = filter.operator;
  const filterValue = filter.value;

  // Handle null/undefined values
  if (columnValue === null || columnValue === undefined) {
    return false;
  }

  // Number columns
  if (isNumberColumn(filter.column)) {
    let numValue = typeof columnValue === 'number' ? columnValue : parseFloat(columnValue) || 0;
    let numFilter = typeof filterValue === 'number' ? filterValue : parseFloat(filterValue) || 0;

    // Handle progress: stored as 0-1, but user enters as percentage (0-100)
    if (filter.column === 'progress') {
      // Convert filter value from percentage to 0-1 range
      numFilter = numFilter / 100;
    }
    
    // Handle size columns: stored as bytes, but user enters as MB
    if (filter.column === 'size' || filter.column === 'total_uploaded' || filter.column === 'total_downloaded') {
      // Convert filter value from MB to bytes
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

  // Text columns
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

  // Timestamp columns (treat as relative time - value is in days, convert to minutes)
  if (isTimestampColumn(filter.column)) {
    if (!columnValue) return false;
    
    const itemTime = new Date(columnValue).getTime();
    if (isNaN(itemTime)) return false;
    
    const now = Date.now();
    const diffMs = now - itemTime;
    const diffMinutes = diffMs / (1000 * 60);
    
    // Filter value is in days, convert to minutes
    const filterDays = typeof filterValue === 'number' ? filterValue : parseFloat(filterValue) || 0;
    const filterMinutes = filterDays * 24 * 60;

    switch (operator) {
      case COMPARISON_OPERATORS.GT:
        // "created_at > 5 days ago" means item was created MORE than 5 days ago (older)
        return diffMinutes > filterMinutes;
      case COMPARISON_OPERATORS.LT:
        // "created_at < 5 days ago" means item was created LESS than 5 days ago (newer)
        return diffMinutes < filterMinutes;
      case COMPARISON_OPERATORS.GTE:
        return diffMinutes >= filterMinutes;
      case COMPARISON_OPERATORS.LTE:
        return diffMinutes <= filterMinutes;
      case COMPARISON_OPERATORS.EQ:
        // Within 1 day tolerance
        return Math.abs(diffMinutes - filterMinutes) < (24 * 60);
      default:
        return true;
    }
  }

  // Boolean columns
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

  // Status columns (multi-select)
  if (isStatusColumn(filter.column)) {
    if (filter.column === 'download_state') {
      // For download_state, use getMatchingStatus to get the proper status label
      const itemStatus = getMatchingStatus(item);
      const itemStatusLabel = itemStatus?.label?.toLowerCase() || '';
      
      // Filter values are lowercase status names like 'downloading', 'uploading', 'stalled'
      const filterValues = Array.isArray(filterValue) 
        ? filterValue.map(v => String(v).toLowerCase()) 
        : [];

      switch (operator) {
        case MULTI_SELECT_OPERATORS.IS_ANY_OF:
          if (filterValues.length === 0) return true;
          // Match against status label (case-insensitive)
          return filterValues.some(fv => itemStatusLabel === fv);
        case MULTI_SELECT_OPERATORS.IS_NONE_OF:
          if (filterValues.length === 0) return true;
          // Item status should NOT be in the filter values
          return !filterValues.some(fv => itemStatusLabel === fv);
        default:
          return true;
      }
    } else if (filter.column === 'asset_type') {
      // For asset_type, match directly
      const itemValue = String(columnValue || '').toLowerCase();
      const filterValues = Array.isArray(filterValue) ? filterValue.map(v => String(v).toLowerCase()) : [];

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

  return true;
};

export function useFilter(
  items,
  initialSearch = '',
  initialStatusFilter = 'all',
  customFilters = [],
) {
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [columnFilters, setColumnFilters] = useState(customFilters);

  // Sync columnFilters with external customFilters prop
  // Deep copy to ensure React detects changes
  useEffect(() => {
    if (customFilters) {
      const deepCopied = JSON.parse(JSON.stringify(customFilters));
      setColumnFilters(deepCopied);
    } else {
      setColumnFilters(customFilters);
    }
  }, [customFilters]);

  const filteredItems = useMemo(() => {
    // Ensure items is an array before filtering
    if (!Array.isArray(items)) {
      console.warn('[useFilter] Expected items to be an array, got:', typeof items);
      return [];
    }

    return items.filter((item) => {
      if (!item || typeof item !== 'object') return false;

      // Handle search filtering
      const matchesSearch =
        !search ||
        (item.name && item.name.toLowerCase().includes(search.toLowerCase()));

      // Handle status filtering
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        try {
          // Handle array of filters
          const filters = Array.isArray(statusFilter)
            ? statusFilter.map((f) =>
                typeof f === 'string' ? JSON.parse(f) : f,
              )
            : [
                typeof statusFilter === 'string'
                  ? JSON.parse(statusFilter)
                  : statusFilter,
              ];

          const itemStatus = getMatchingStatus(item);

          // If filtering for Downloading status, also include Meta_DL and Checking_Resume_Data
          if (
            itemStatus.label === 'Meta_DL' ||
            itemStatus.label === 'Checking_Resume_Data'
          ) {
            const downloadingFilter = filters.find(
              (f) =>
                JSON.stringify(f) ===
                JSON.stringify({
                  active: true,
                  download_finished: false,
                  download_present: false,
                }),
            );
            if (downloadingFilter) return true;
          }

          matchesStatus = filters.some((filter) => {
            return JSON.stringify(filter) === JSON.stringify(itemStatus.value);
          });
        } catch (e) {
          console.error('Error parsing status filter:', e);
          matchesStatus = false;
        }
      }

      // Handle column-based filters with group support
      let matchesColumnFilters = true;
      
      if (columnFilters && typeof columnFilters === 'object') {
        // New group structure
        if (columnFilters.groups && Array.isArray(columnFilters.groups)) {
          const groupLogic = columnFilters.logicOperator || LOGIC_OPERATORS.AND;
          
          // Evaluate each group
          const groupResults = columnFilters.groups.map((group) => {
            const groupLogicOp = group.logicOperator || LOGIC_OPERATORS.AND;
            const filters = group.filters || [];
            
            if (filters.length === 0) return true;
            
            // Evaluate filters within the group
            const filterResults = filters
              .filter(f => f.column) // Only evaluate filters with a column
              .map(filter => evaluateFilter(filter, item));
            
            if (filterResults.length === 0) return true;
            
            // Apply group logic
            if (groupLogicOp === LOGIC_OPERATORS.OR) {
              return filterResults.some(result => result === true);
            } else {
              return filterResults.every(result => result === true);
            }
          });
          
          // Apply logic between groups
          if (groupResults.length === 0) {
            matchesColumnFilters = true;
          } else if (groupLogic === LOGIC_OPERATORS.OR) {
            matchesColumnFilters = groupResults.some(result => result === true);
          } else {
            matchesColumnFilters = groupResults.every(result => result === true);
          }
        } else if (Array.isArray(columnFilters)) {
          // Old flat structure - backward compatibility
          matchesColumnFilters = columnFilters.length === 0 || 
            columnFilters.every(filter => evaluateFilter(filter, item));
        }
      } else if (Array.isArray(columnFilters)) {
        // Old flat structure
        matchesColumnFilters = columnFilters.length === 0 || 
          columnFilters.every(filter => evaluateFilter(filter, item));
      }

      return matchesSearch && matchesStatus && matchesColumnFilters;
    });
  }, [items, search, statusFilter, columnFilters]);

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    columnFilters,
    setColumnFilters,
    filteredItems,
  };
}

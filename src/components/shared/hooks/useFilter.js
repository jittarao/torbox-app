'use client';

import { useState, useMemo, useEffect } from 'react';
import { getMatchingStatus } from '@/components/downloads/ActionBar/utils/statusHelpers';
import { LOGIC_OPERATORS } from '@/components/downloads/AutomationRules/constants';
import { itemMatchesFilters } from '@/components/downloads/filters/filterEvaluation';
import { itemMatchesDownloadSearch } from '@/components/downloads/utils/downloadSearch';

export function useFilter(
  items,
  initialSearch = '',
  initialStatusFilter = 'all',
  customFilters = []
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

      const matchesSearch = itemMatchesDownloadSearch(item, search);

      // Handle status filtering
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        try {
          // Handle array of filters
          const filters = Array.isArray(statusFilter)
            ? statusFilter.map((f) => (typeof f === 'string' ? JSON.parse(f) : f))
            : [typeof statusFilter === 'string' ? JSON.parse(statusFilter) : statusFilter];

          const itemStatus = getMatchingStatus(item);

          // If filtering for Downloading status, also include Meta_DL and Checking_Resume_Data
          if (itemStatus.label === 'Meta_DL' || itemStatus.label === 'Checking_Resume_Data') {
            const downloadingFilter = filters.find(
              (f) =>
                JSON.stringify(f) ===
                JSON.stringify({
                  active: true,
                  download_finished: false,
                  download_present: false,
                })
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

      const matchesColumnFilters = itemMatchesFilters(item, columnFilters);

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

'use client';

import { useState, useMemo } from 'react';
import { getMatchingStatus } from '@/components/downloads/ActionBar/utils/statusHelpers';

export function useFilter(
  items,
  initialSearch = '',
  initialStatusFilter = 'all',
) {
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);

  const filteredItems = useMemo(() => {
    // Ensure items is an array before filtering
    if (!Array.isArray(items)) {
      console.warn('Expected items to be an array, got:', typeof items);
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

      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filteredItems,
  };
}

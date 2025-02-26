'use client';
import { useState, useMemo } from 'react';

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
          // Parse the filter if it's a string
          const filter =
            typeof statusFilter === 'string' && statusFilter !== 'all'
              ? JSON.parse(statusFilter)
              : statusFilter;

          // Special handling for queued items
          if (filter.is_queued) {
            return matchesSearch && !item.download_state;
          }

          // Check all conditions in the filter
          matchesStatus = Object.entries(filter).every(([key, value]) => {
            // Special handling for download_state arrays
            if (key === 'download_state') {
              const states = Array.isArray(value) ? value : [value];
              return states.some(
                (state) =>
                  typeof state === 'string' &&
                  item.download_state?.includes(state),
              );
            }

            // Direct comparison for other properties
            return item[key] === value;
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

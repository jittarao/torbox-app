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

          // Item matches if it matches ANY of the selected filters
          matchesStatus = filters.some((filter) => {
            if (filter.is_queued) {
              return !item.download_state;
            }

            return Object.entries(filter).every(([key, value]) => {
              if (key === 'download_state') {
                const states = Array.isArray(value) ? value : [value];
                return states.some(
                  (state) =>
                    typeof state === 'string' &&
                    item.download_state?.includes(state),
                );
              }
              return item[key] === value;
            });
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

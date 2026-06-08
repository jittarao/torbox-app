'use client';

import { useCallback, useEffect, useRef } from 'react';
import { shouldAutoExpandItemForSearch } from '../utils/downloadSearch';

/**
 * Auto-expand rows when file-name search matches nested files; collapse on clear.
 * Respects manual collapse while the same query is active.
 */
export function useDownloadsSearchExpand({
  search,
  sortedItems,
  selectedItems,
  setExpanded,
  collapseAllExpanded,
}) {
  const searchExpandedItemIdsRef = useRef(new Set());
  const userCollapsedIdsRef = useRef(new Set());
  const lastSearchRef = useRef(search);

  useEffect(() => {
    const query = search.trim();
    const prevQuery = lastSearchRef.current.trim();

    if (query !== prevQuery) {
      for (const id of searchExpandedItemIdsRef.current) {
        if (selectedItems.files.has(id)) continue;
        setExpanded(id, false);
      }
      searchExpandedItemIdsRef.current = new Set();
      userCollapsedIdsRef.current = new Set();
      lastSearchRef.current = search;
    }

    if (!query) {
      const searchExpanded = searchExpandedItemIdsRef.current;
      if (searchExpanded.size === 0) return;

      for (const id of searchExpanded) {
        if (selectedItems.files.has(id)) continue;
        setExpanded(id, false);
      }
      searchExpandedItemIdsRef.current = new Set();
      userCollapsedIdsRef.current = new Set();
      return;
    }

    for (const item of sortedItems) {
      if (
        shouldAutoExpandItemForSearch(item, query) &&
        !userCollapsedIdsRef.current.has(item.id) &&
        !searchExpandedItemIdsRef.current.has(item.id)
      ) {
        setExpanded(item.id, true);
        searchExpandedItemIdsRef.current.add(item.id);
      }
    }
  }, [search, sortedItems, selectedItems.files, setExpanded]);

  const notifySearchToggleFiles = useCallback(
    (itemId, isCurrentlyExpanded) => {
      searchExpandedItemIdsRef.current.delete(itemId);
      if (!search.trim()) return;
      if (isCurrentlyExpanded) {
        userCollapsedIdsRef.current.add(itemId);
      } else {
        userCollapsedIdsRef.current.delete(itemId);
      }
    },
    [search]
  );

  const collapseAllFiles = useCallback(() => {
    searchExpandedItemIdsRef.current = new Set();
    userCollapsedIdsRef.current = new Set();
    collapseAllExpanded();
  }, [collapseAllExpanded]);

  return { searchExpandedItemIdsRef, collapseAllFiles, notifySearchToggleFiles };
}

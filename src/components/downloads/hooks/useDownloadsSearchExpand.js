'use client';

import { useEffect, useRef } from 'react';
import { itemHasFileNameSearchMatch } from '../utils/downloadSearch';

/**
 * Auto-expand rows when file-name search matches nested files; collapse on clear.
 */
export function useDownloadsSearchExpand({
  search,
  sortedItems,
  selectedItems,
  expandedById,
  setExpanded,
  collapseAllExpanded,
}) {
  const searchExpandedItemIdsRef = useRef(new Set());

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      const searchExpanded = searchExpandedItemIdsRef.current;
      if (searchExpanded.size === 0) return;

      for (const id of searchExpanded) {
        if (selectedItems.files.has(id)) continue;
        setExpanded(id, false);
      }
      searchExpandedItemIdsRef.current = new Set();
      return;
    }

    for (const item of sortedItems) {
      if (
        itemHasFileNameSearchMatch(item, query) &&
        item.files?.length > 0 &&
        !expandedById[item.id]
      ) {
        setExpanded(item.id, true);
        searchExpandedItemIdsRef.current.add(item.id);
      }
    }
  }, [search, sortedItems, selectedItems.files, expandedById, setExpanded]);

  const collapseAllFiles = () => {
    searchExpandedItemIdsRef.current = new Set();
    collapseAllExpanded();
  };

  return { searchExpandedItemIdsRef, collapseAllFiles };
}

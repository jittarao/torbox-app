'use client';

import { useCallback, useState } from 'react';

/**
 * Tracks user overrides for search-driven auto-expand/collapse.
 * Expansion is derived at read time; no parent store writes from effects.
 */
export function useDownloadsSearchExpand({ search, collapseAllExpanded }) {
  const [userCollapsedIds, setUserCollapsedIds] = useState(() => new Set());
  const [collapsedForSearch, setCollapsedForSearch] = useState(search);

  if (search !== collapsedForSearch) {
    setCollapsedForSearch(search);
    setUserCollapsedIds(new Set());
  }

  const resetSearchCollapsePrefs = useCallback(() => {
    setUserCollapsedIds(new Set());
  }, []);

  const notifySearchToggleFiles = useCallback(
    (itemId, isCurrentlyExpanded) => {
      if (!search.trim()) return;
      setUserCollapsedIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyExpanded) {
          next.add(itemId);
        } else {
          next.delete(itemId);
        }
        return next;
      });
    },
    [search]
  );

  const collapseAllFiles = useCallback(() => {
    setUserCollapsedIds(new Set());
    collapseAllExpanded();
  }, [collapseAllExpanded]);

  return {
    searchUserCollapsedIds: userCollapsedIds,
    resetSearchCollapsePrefs,
    collapseAllFiles,
    notifySearchToggleFiles,
  };
}

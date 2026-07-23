'use client';

import { useMemo } from 'react';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { useDownloadsFilterContext } from '@/components/downloads/DownloadsFilterContext';
import { shouldAutoExpandItemForSearch } from '@/components/downloads/utils/downloadSearch';

/**
 * Row expanded when manually expanded in UI store or auto-expanded for active file search.
 */
export function useIsDownloadRowExpanded(item) {
  const manualExpanded = useDownloadsUiStore((state) => Boolean(state.expandedById[item.id]));
  const { debouncedSearch, searchUserCollapsedIds } = useDownloadsFilterContext();
  const filesByEntityKey = useTorboxDownloadsStore((state) => state.filesByEntityKey);

  return useMemo(() => {
    if (manualExpanded) return true;

    const query = debouncedSearch?.trim() ?? '';
    if (!query || searchUserCollapsedIds?.has(item.id)) return false;

    return shouldAutoExpandItemForSearch(item, query, filesByEntityKey);
  }, [manualExpanded, debouncedSearch, searchUserCollapsedIds, item, filesByEntityKey]);
}

/**
 * Merges manual row expansion with search-driven auto-expansion for table virtualization.
 */
export function useEffectiveExpandedById(items) {
  const expandedById = useDownloadsUiStore((state) => state.expandedById);
  const { debouncedSearch, searchUserCollapsedIds } = useDownloadsFilterContext();
  const filesByEntityKey = useTorboxDownloadsStore((state) => state.filesByEntityKey);

  return useMemo(() => {
    const query = debouncedSearch?.trim() ?? '';
    if (!query) return expandedById;

    let changed = false;
    const next = { ...expandedById };

    for (const item of items) {
      if (next[item.id] || searchUserCollapsedIds?.has(item.id)) continue;
      if (shouldAutoExpandItemForSearch(item, query, filesByEntityKey)) {
        next[item.id] = true;
        changed = true;
      }
    }

    return changed ? next : expandedById;
  }, [expandedById, items, debouncedSearch, searchUserCollapsedIds, filesByEntityKey]);
}

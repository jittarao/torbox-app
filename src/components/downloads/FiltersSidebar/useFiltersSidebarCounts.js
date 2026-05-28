'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { useDownloadTagsStore } from '@/store/downloadTagsStore';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import {
  countDownloadsPerTagFromStore,
  countDownloadsPerViewFromStore,
} from '@/store/downloadsDerivedSelectors';

/**
 * Sidebar tag/view counts derived from entity store (no viewItems prop).
 */
export function useFiltersSidebarCounts(activeAssetType, views) {
  const torboxSlice = useTorboxDownloadsStore(
    useShallow((s) => ({
      entities: s.entities,
      order: s.order,
    }))
  );
  const tagMappings = useDownloadTagsStore((s) => s.tagMappings);
  const downloadHistory = useDownloadHistoryStore((s) => s.downloadHistory);

  const tagCounts = useMemo(
    () => countDownloadsPerTagFromStore(torboxSlice, activeAssetType, tagMappings),
    [torboxSlice, activeAssetType, tagMappings]
  );

  const viewCounts = useMemo(
    () =>
      countDownloadsPerViewFromStore(
        views,
        torboxSlice,
        activeAssetType,
        tagMappings,
        downloadHistory
      ),
    [views, torboxSlice, activeAssetType, tagMappings, downloadHistory]
  );

  return { tagCounts, viewCounts };
}

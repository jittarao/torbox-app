'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { useDownloadTagsStore } from '@/store/downloadTagsStore';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import {
  countDownloadsPerTagFromStore,
  countDownloadsPerViewFromStore,
  countDownloadsPerTrackerFromStore,
  countDownloadsPerSourceFromStore,
} from '@/store/downloadsDerivedSelectors';
import { formatTrackerLabel } from '@/components/downloads/filters/trackerDisplay';
import { formatSourceLabel } from '@/components/downloads/filters/sourceDisplay';

function buildSortedEntries(counts, getKey, formatLabel) {
  return Object.entries(counts)
    .map(([key, count]) => ({
      [getKey]: key,
      label: formatLabel(key),
      count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
}

function buildTrackerEntries(torboxSlice) {
  const counts = countDownloadsPerTrackerFromStore(torboxSlice);
  return buildSortedEntries(counts, 'url', formatTrackerLabel).map(({ url, label, count }) => ({
    url,
    label,
    count,
  }));
}

function buildSourceEntries(torboxSlice) {
  const counts = countDownloadsPerSourceFromStore(torboxSlice);
  return buildSortedEntries(counts, 'host', formatSourceLabel).map(({ host, label, count }) => ({
    host,
    label,
    count,
  }));
}

/**
 * Sidebar counts and tracker/source lists derived from entity store (single subscription).
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

  return useMemo(() => {
    const tagCounts = countDownloadsPerTagFromStore(torboxSlice, activeAssetType, tagMappings);
    const viewCounts = countDownloadsPerViewFromStore(
      views,
      torboxSlice,
      activeAssetType,
      tagMappings,
      downloadHistory
    );
    const trackerEntries = buildTrackerEntries(torboxSlice);
    const sourceEntries = buildSourceEntries(torboxSlice);

    return { tagCounts, viewCounts, trackerEntries, sourceEntries };
  }, [torboxSlice, activeAssetType, views, tagMappings, downloadHistory]);
}

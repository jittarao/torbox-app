'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
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
import { selectViewOrderedIds } from '@/store/torboxDownloadsSelectors';
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

function rowRefsUnchanged(viewIds, entities, cachedIds, cachedRowRefs) {
  if (cachedIds.length !== viewIds.length) return false;
  for (let i = 0; i < viewIds.length; i++) {
    if (cachedIds[i] !== viewIds[i]) return false;
    if (cachedRowRefs[i] !== entities[viewIds[i]]) return false;
  }
  return true;
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

  const viewIds = useMemo(
    () => selectViewOrderedIds(torboxSlice, activeAssetType),
    [torboxSlice, activeAssetType]
  );

  const countsCacheRef = useRef({
    viewIds: [],
    rowRefs: [],
    activeAssetType: null,
    views,
    tagMappings: null,
    downloadHistory: null,
    tagCounts: {},
    viewCounts: {},
    trackerEntries: [],
    sourceEntries: [],
  });

  const counts = useMemo(() => {
    const cache = countsCacheRef.current;
    const metaUnchanged =
      cache.activeAssetType === activeAssetType &&
      cache.views === views &&
      cache.tagMappings === tagMappings &&
      cache.downloadHistory === downloadHistory;

    const refsUnchanged =
      metaUnchanged &&
      rowRefsUnchanged(viewIds, torboxSlice.entities, cache.viewIds, cache.rowRefs);

    if (refsUnchanged) {
      return {
        tagCounts: cache.tagCounts,
        viewCounts: cache.viewCounts,
        trackerEntries: cache.trackerEntries,
        sourceEntries: cache.sourceEntries,
      };
    }

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
  }, [torboxSlice, activeAssetType, views, tagMappings, downloadHistory, viewIds]);

  useLayoutEffect(() => {
    countsCacheRef.current = {
      viewIds: viewIds.slice(),
      rowRefs: viewIds.map((id) => torboxSlice.entities[id]),
      activeAssetType,
      views,
      tagMappings,
      downloadHistory,
      tagCounts: counts.tagCounts,
      viewCounts: counts.viewCounts,
      trackerEntries: counts.trackerEntries,
      sourceEntries: counts.sourceEntries,
    };
  }, [viewIds, torboxSlice.entities, activeAssetType, views, tagMappings, downloadHistory, counts]);

  return counts;
}

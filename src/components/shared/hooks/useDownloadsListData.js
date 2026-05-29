'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { buildDownloadHistoryLookup } from '@/components/downloads/utils/tbmDownloadEnrichment';
import { selectViewOrderedIds } from '@/store/torboxDownloadsSelectors';
import { selectVisibleSortedIds, idsToRows } from '@/store/downloadsDerivedSelectors';
import { useTags } from '@/components/shared/hooks/useTags';
import { useDownloadTags } from '@/components/shared/hooks/useDownloadTags';

function useStableShallow(value) {
  const ref = useRef(value);
  if (value !== ref.current) {
    ref.current = value;
  }
  return ref.current;
}

export function useDownloadsListData(activeType, apiKey, isBackendAvailable) {
  const downloadHistory = useDownloadHistoryStore((state) => state.downloadHistory);

  const downloadHistoryLookup = useMemo(
    () => buildDownloadHistoryLookup(downloadHistory),
    [downloadHistory]
  );

  const { loadTags, tags, loading: tagsLoading, updateTag: updateTagName } = useTags(apiKey);

  const {
    fetchDownloadTags,
    tagMappings,
    loading: downloadTagsLoading,
  } = useDownloadTags(apiKey);

  useEffect(() => {
    if (isBackendAvailable && apiKey && tags.length === 0 && !tagsLoading) {
      loadTags();
    }
  }, [apiKey, isBackendAvailable, tags.length, tagsLoading, loadTags]);

  useEffect(() => {
    if (
      isBackendAvailable &&
      apiKey &&
      Object.keys(tagMappings).length === 0 &&
      !downloadTagsLoading
    ) {
      fetchDownloadTags();
    }
  }, [apiKey, isBackendAvailable, tagMappings, downloadTagsLoading, fetchDownloadTags]);

  // Subscribe to individual store fields — entities reference is stable when unchanged
  const entities = useTorboxDownloadsStore((state) => state.entities);
  const order = useTorboxDownloadsStore((state) => state.order);

  const filterCriteria = useDownloadsUiStore(
    useShallow((state) => ({
      search: state.search,
      statusFilter: state.statusFilter,
      appliedFilters: state.appliedFilters,
      sortField: state.sortField,
      sortDirection: state.sortDirection,
    }))
  );
  const stableTagMappings = useStableShallow(tagMappings);
  const stableDownloadHistory = useStableShallow(downloadHistory);

  const combinedState = useMemo(
    () => ({ entities, order }),
    [entities, order]
  );

  const viewItems = useMemo(() => {
    const ids = selectViewOrderedIds(combinedState, activeType);
    return idsToRows(ids, entities, stableTagMappings, stableDownloadHistory);
  }, [combinedState, activeType, stableTagMappings, stableDownloadHistory]);

  const visibleIds = useMemo(
    () =>
      selectVisibleSortedIds(
        combinedState,
        activeType,
        filterCriteria,
        stableTagMappings,
        downloadHistoryLookup
      ),
    [combinedState, activeType, filterCriteria, stableTagMappings, downloadHistoryLookup]
  );

  const sortedItems = useMemo(
    () => idsToRows(visibleIds, entities, stableTagMappings, stableDownloadHistory),
    [visibleIds, entities, stableTagMappings, stableDownloadHistory]
  );

  return {
    viewItems,
    sortedItems,
    visibleIds,
    downloadHistory,
    downloadHistoryLookup,
    tags,
    tagsLoading,
    updateTagName,
    tagMappings,
  };
}

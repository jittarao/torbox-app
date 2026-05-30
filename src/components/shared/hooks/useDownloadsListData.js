'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { buildDownloadHistoryLookup } from '@/components/downloads/utils/tbmDownloadEnrichment';
import { selectViewOrderedIds } from '@/store/torboxDownloadsSelectors';
import { selectVisibleSortedFromMap, idsToRows } from '@/store/downloadsDerivedSelectors';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
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

  const {
    loadTags,
    tags,
    loading: tagsLoading,
    hasLoaded: tagsHasLoaded,
    updateTag: updateTagName,
  } = useTags(apiKey);

  const {
    fetchDownloadTags,
    tagMappings,
    loading: downloadTagsLoading,
    hasLoaded: downloadTagsHasLoaded,
  } = useDownloadTags(apiKey);

  useEffect(() => {
    if (isBackendAvailable && apiKey && !tagsHasLoaded && !tagsLoading) {
      loadTags();
    }
  }, [apiKey, isBackendAvailable, tagsHasLoaded, tagsLoading, loadTags]);

  useEffect(() => {
    if (isBackendAvailable && apiKey && !downloadTagsHasLoaded && !downloadTagsLoading) {
      fetchDownloadTags();
    }
  }, [apiKey, isBackendAvailable, downloadTagsHasLoaded, downloadTagsLoading, fetchDownloadTags]);

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

  const combinedState = useMemo(() => ({ entities, order }), [entities, order]);

  const allRows = useMemo(() => {
    const ids = selectViewOrderedIds(combinedState, activeType);
    return idsToRows(ids, entities, stableTagMappings, stableDownloadHistory);
  }, [combinedState, activeType, stableTagMappings, stableDownloadHistory]);

  const enrichedMap = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      map.set(getDownloadSelectionId(row), row);
    }
    return map;
  }, [allRows]);

  const allIds = useMemo(
    () => selectViewOrderedIds(combinedState, activeType),
    [combinedState, activeType]
  );

  const visibleIds = useMemo(() =>
    selectVisibleSortedFromMap(allIds, enrichedMap, filterCriteria, entities),
    [allIds, enrichedMap, filterCriteria, entities]
  );

  const sortedItems = useMemo(
    () => {
      const result = new Array(visibleIds.length);
      let needsFallback = false;
      for (let i = 0; i < visibleIds.length; i++) {
        result[i] = enrichedMap.get(visibleIds[i]);
        if (result[i] === undefined) needsFallback = true;
      }
      if (needsFallback) {
        return idsToRows(visibleIds, entities, stableTagMappings, stableDownloadHistory);
      }
      return result;
    },
    [visibleIds, enrichedMap, entities, stableTagMappings, stableDownloadHistory]
  );

  return {
    viewItems: allRows,
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

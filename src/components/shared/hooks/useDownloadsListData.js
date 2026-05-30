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

  const { entities, order } = useTorboxDownloadsStore(
    useShallow((s) => ({ entities: s.entities, order: s.order }))
  );

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

  // Get order for active view, then enrich and build a selection-key map in one pass.
  const allRows = useMemo(() => {
    const ids = selectViewOrderedIds({ entities, order }, activeType);
    return idsToRows(ids, entities, stableTagMappings, stableDownloadHistory);
  }, [entities, order, activeType, stableTagMappings, stableDownloadHistory]);

  const enrichedMap = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < allRows.length; i++) {
      map.set(getDownloadSelectionId(allRows[i]), allRows[i]);
    }
    return map;
  }, [allRows]);

  const viewIds = useMemo(
    () => selectViewOrderedIds({ entities, order }, activeType),
    [entities, order, activeType]
  );

  const visibleIds = useMemo(() =>
    selectVisibleSortedFromMap(viewIds, enrichedMap, filterCriteria, entities),
    [viewIds, enrichedMap, filterCriteria, entities]
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

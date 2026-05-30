'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { useDownloadsFilterParams } from '@/hooks/useDownloadsFilterParams';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { buildDownloadHistoryLookup } from '@/components/downloads/utils/tbmDownloadEnrichment';
import { selectViewOrderedIds } from '@/store/torboxDownloadsSelectors';
import { selectVisibleSortedFromMap, idsToRows } from '@/store/downloadsDerivedSelectors';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { fileListSignature } from '@/utils/downloadListMerge';
import { useTags } from '@/components/shared/hooks/useTags';
import { useDownloadTags } from '@/components/shared/hooks/useDownloadTags';

function useStableShallow(value) {
  const ref = useRef(value);
  if (value !== ref.current) {
    ref.current = value;
  }
  return ref.current;
}

/** Order-preserving signature of list row fields used by enrichment/filter. */
function buildViewDataSignature(viewIds, entities) {
  if (!viewIds?.length) return '';
  const parts = new Array(viewIds.length);
  for (let i = 0; i < viewIds.length; i++) {
    const key = viewIds[i];
    const e = entities[key];
    if (!e) {
      parts[i] = `${key}:missing`;
      continue;
    }
    parts[i] = `${key}:${e.progress ?? 0}:${e.download_state ?? ''}:${e.active ? 1 : 0}:${e.download_finished ? 1 : 0}:${fileListSignature(e.files)}:${e.updated_at ?? ''}`;
  }
  return parts.join('|');
}

function buildFilterCacheKey(criteria) {
  return JSON.stringify({
    search: criteria.search,
    statusFilter: criteria.statusFilter,
    sortField: criteria.sortField,
    sortDirection: criteria.sortDirection,
    appliedFilters: criteria.appliedFilters,
  });
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

  const {
    search,
    statusFilter,
    appliedFilters,
    sortField,
    sortDirection,
  } = useDownloadsFilterParams();

  const filterCriteria = useMemo(
    () => ({
      search,
      statusFilter,
      appliedFilters,
      sortField,
      sortDirection,
    }),
    [search, statusFilter, appliedFilters, sortField, sortDirection]
  );
  const stableTagMappings = useStableShallow(tagMappings);
  const stableDownloadHistory = useStableShallow(downloadHistory);

  const deriveCacheRef = useRef({
    viewDataSig: '',
    filterKey: '',
    tagMappings: null,
    downloadHistory: null,
    activeType: null,
    allRows: [],
    enrichedMap: new Map(),
    visibleIds: [],
    sortedItems: [],
  });

  const viewIds = useMemo(
    () => selectViewOrderedIds({ entities, order }, activeType),
    [entities, order, activeType]
  );

  const viewDataSig = useMemo(
    () => buildViewDataSignature(viewIds, entities),
    [viewIds, entities]
  );

  const filterKey = useMemo(() => buildFilterCacheKey(filterCriteria), [filterCriteria]);

  const { allRows, enrichedMap, visibleIds, sortedItems } = useMemo(() => {
    const cache = deriveCacheRef.current;
    const listInputsUnchanged =
      cache.viewDataSig === viewDataSig &&
      cache.tagMappings === stableTagMappings &&
      cache.downloadHistory === stableDownloadHistory &&
      cache.activeType === activeType;

    let rows = cache.allRows;
    let map = cache.enrichedMap;

    if (!listInputsUnchanged) {
      rows = idsToRows(viewIds, entities, stableTagMappings, stableDownloadHistory);
      map = new Map();
      for (let i = 0; i < rows.length; i++) {
        map.set(getDownloadSelectionId(rows[i]), rows[i]);
      }
    }

    let ids = cache.visibleIds;
    let items = cache.sortedItems;

    if (!listInputsUnchanged || cache.filterKey !== filterKey) {
      ids = selectVisibleSortedFromMap(viewIds, map, filterCriteria, entities);
      items = new Array(ids.length);
      let needsFallback = false;
      for (let i = 0; i < ids.length; i++) {
        items[i] = map.get(ids[i]);
        if (items[i] === undefined) needsFallback = true;
      }
      if (needsFallback) {
        items = idsToRows(ids, entities, stableTagMappings, stableDownloadHistory);
      }
    }

    deriveCacheRef.current = {
      viewDataSig,
      filterKey,
      tagMappings: stableTagMappings,
      downloadHistory: stableDownloadHistory,
      activeType,
      allRows: rows,
      enrichedMap: map,
      visibleIds: ids,
      sortedItems: items,
    };

    return { allRows: rows, enrichedMap: map, visibleIds: ids, sortedItems: items };
  }, [
    viewIds,
    viewDataSig,
    entities,
    filterKey,
    filterCriteria,
    stableTagMappings,
    stableDownloadHistory,
    activeType,
  ]);

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

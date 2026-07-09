'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { buildDownloadHistoryLookup } from '@/components/downloads/utils/tbmDownloadEnrichment';
import { selectViewOrderedIds } from '@/store/torboxDownloadsSelectors';
import {
  selectVisibleSortedFromMap,
  idsToRows,
  enrichRowForFilter,
} from '@/store/downloadsDerivedSelectors';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { buildRowDataSignature, collectDirtyRowKeys } from '@/utils/downloadListSignatures';
import { useTags } from '@/components/shared/hooks/useTags';
import { useDownloadTags } from '@/components/shared/hooks/useDownloadTags';
import { useProtectedDownloads } from '@/components/shared/hooks/useProtectedDownloads';

function useStableShallow(value) {
  const ref = useRef(value);
  if (value !== ref.current) {
    ref.current = value;
  }
  return ref.current;
}

function buildFilterCacheKey(criteria) {
  const orViewIds =
    criteria.orViewFilters?.map((view) => view?.id).filter((id) => id != null) ?? null;
  return JSON.stringify({
    search: criteria.search,
    statusFilter: criteria.statusFilter,
    sortField: criteria.sortField,
    sortDirection: criteria.sortDirection,
    appliedFilters: criteria.appliedFilters,
    orViewIds,
  });
}

function syncRowSignatures(viewIds, entities, targetMap) {
  targetMap.clear();
  for (let i = 0; i < viewIds.length; i++) {
    const key = viewIds[i];
    targetMap.set(key, buildRowDataSignature(key, entities[key]));
  }
}

export function useDownloadsListData(activeType, apiKey, isBackendAvailable, filterParams) {
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

  const {
    fetchProtectedDownloads,
    protectedMap,
    loading: protectedLoading,
    hasLoaded: protectedHasLoaded,
  } = useProtectedDownloads(apiKey);

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

  useEffect(() => {
    if (isBackendAvailable && apiKey && !protectedHasLoaded && !protectedLoading) {
      fetchProtectedDownloads();
    }
  }, [apiKey, isBackendAvailable, protectedHasLoaded, protectedLoading, fetchProtectedDownloads]);

  const { entities, order } = useTorboxDownloadsStore(
    useShallow((s) => ({ entities: s.entities, order: s.order }))
  );

  const { search, statusFilter, appliedFilters, orViewFilters, sortField, sortDirection } =
    filterParams;

  const filterCriteria = useMemo(
    () => ({
      search,
      statusFilter,
      appliedFilters,
      orViewFilters,
      sortField,
      sortDirection,
    }),
    [search, statusFilter, appliedFilters, orViewFilters, sortField, sortDirection]
  );
  const stableTagMappings = useStableShallow(tagMappings);
  const stableProtectedMap = useStableShallow(protectedMap);
  const stableDownloadHistory = useStableShallow(downloadHistory);

  const deriveCacheRef = useRef({
    filterKey: '',
    tagMappings: null,
    protectedMap: null,
    downloadHistory: null,
    activeType: null,
    viewIds: [],
    rowSigs: new Map(),
    allRows: [],
    enrichedMap: new Map(),
    visibleIds: [],
    sortedItems: [],
  });

  const viewIds = useMemo(
    () => selectViewOrderedIds({ entities, order }, activeType),
    [entities, order, activeType]
  );

  const viewIdIndexMap = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < viewIds.length; i++) {
      map.set(viewIds[i], i);
    }
    return map;
  }, [viewIds]);

  const filterKey = useMemo(() => buildFilterCacheKey(filterCriteria), [filterCriteria]);

  const { allRows, enrichedMap, visibleIds, sortedItems } = useMemo(() => {
    const cache = deriveCacheRef.current;
    const metaUnchanged =
      cache.tagMappings === stableTagMappings &&
      cache.protectedMap === stableProtectedMap &&
      cache.downloadHistory === stableDownloadHistory &&
      cache.activeType === activeType;

    const dirtyKeys =
      metaUnchanged && cache.enrichedMap.size > 0
        ? collectDirtyRowKeys(viewIds, entities, cache.rowSigs, cache.viewIds)
        : null;

    let rows = cache.allRows;
    let map = cache.enrichedMap;

    const needsFullListRebuild =
      !metaUnchanged || dirtyKeys === null || dirtyKeys.length === viewIds.length;

    if (needsFullListRebuild) {
      rows = idsToRows(
        viewIds,
        entities,
        stableTagMappings,
        stableDownloadHistory,
        stableProtectedMap
      );
      map = new Map();
      for (let i = 0; i < rows.length; i++) {
        map.set(getDownloadSelectionId(rows[i]), rows[i]);
      }
      syncRowSignatures(viewIds, entities, cache.rowSigs);
    } else if (dirtyKeys.length > 0) {
      rows = rows.slice();
      for (let d = 0; d < dirtyKeys.length; d++) {
        const key = dirtyKeys[d];
        const entity = entities[key];
        const row = enrichRowForFilter(
          entity,
          stableTagMappings,
          stableDownloadHistory,
          stableProtectedMap
        );
        if (!row) continue;
        const selectionId = getDownloadSelectionId(row);
        map.set(selectionId, row);
        const idx = viewIdIndexMap.get(key);
        if (idx !== undefined) {
          rows[idx] = row;
        }
        cache.rowSigs.set(key, buildRowDataSignature(key, entity));
      }
    }

    let ids = cache.visibleIds;
    let items = cache.sortedItems;

    const filterUnchanged = cache.filterKey === filterKey;
    const listStable = needsFullListRebuild ? false : dirtyKeys.length === 0;

    if (!filterUnchanged || !listStable) {
      ids = selectVisibleSortedFromMap(viewIds, map, filterCriteria, entities);
      items = new Array(ids.length);
      let needsFallback = false;
      for (let i = 0; i < ids.length; i++) {
        items[i] = map.get(ids[i]);
        if (items[i] === undefined) needsFallback = true;
      }
      if (needsFallback) {
        items = idsToRows(
          ids,
          entities,
          stableTagMappings,
          stableDownloadHistory,
          stableProtectedMap
        );
      }
    }

    deriveCacheRef.current = {
      filterKey,
      tagMappings: stableTagMappings,
      protectedMap: stableProtectedMap,
      downloadHistory: stableDownloadHistory,
      activeType,
      viewIds,
      rowSigs: cache.rowSigs,
      allRows: rows,
      enrichedMap: map,
      visibleIds: ids,
      sortedItems: items,
    };

    return { allRows: rows, enrichedMap: map, visibleIds: ids, sortedItems: items };
  }, [
    viewIds,
    entities,
    filterKey,
    filterCriteria,
    stableTagMappings,
    stableProtectedMap,
    stableDownloadHistory,
    activeType,
    viewIdIndexMap,
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
    protectedMap,
  };
}

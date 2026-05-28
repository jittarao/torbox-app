'use client';

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { buildDownloadHistoryLookup } from '@/components/downloads/utils/tbmDownloadEnrichment';
import { selectViewOrderedIds } from '@/store/torboxDownloadsSelectors';
import { selectVisibleSortedIds, idsToRows } from '@/store/downloadsDerivedSelectors';
import { useTags } from '@/components/shared/hooks/useTags';
import { useDownloadTags } from '@/components/shared/hooks/useDownloadTags';

/**
 * View + visible download rows (derived from stores, not persisted arrays).
 */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, isBackendAvailable]);

  useEffect(() => {
    if (
      isBackendAvailable &&
      apiKey &&
      Object.keys(tagMappings).length === 0 &&
      !downloadTagsLoading
    ) {
      fetchDownloadTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, isBackendAvailable]);

  const torboxSlice = useTorboxDownloadsStore(
    useShallow((s) => ({
      entities: s.entities,
      order: s.order,
    }))
  );

  const filterCriteria = useDownloadsUiStore(
    useShallow((s) => ({
      search: s.search,
      statusFilter: s.statusFilter,
      appliedFilters: s.appliedFilters,
      sortField: s.sortField,
      sortDirection: s.sortDirection,
    }))
  );

  const viewItems = useMemo(() => {
    const ids = selectViewOrderedIds(torboxSlice, activeType);
    return idsToRows(ids, torboxSlice.entities, tagMappings, downloadHistory);
  }, [torboxSlice, activeType, tagMappings, downloadHistory]);

  const visibleIds = useMemo(
    () =>
      selectVisibleSortedIds(
        torboxSlice,
        activeType,
        filterCriteria,
        tagMappings,
        downloadHistoryLookup
      ),
    [torboxSlice, activeType, filterCriteria, tagMappings, downloadHistoryLookup]
  );

  const sortedItems = useMemo(
    () => idsToRows(visibleIds, torboxSlice.entities, tagMappings, downloadHistory),
    [visibleIds, torboxSlice.entities, tagMappings, downloadHistory]
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

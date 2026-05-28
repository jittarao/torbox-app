'use client';

import { useEffect, useMemo } from 'react';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { useDownloadTags } from '@/components/shared/hooks/useDownloadTags';
import { useTags } from '@/components/shared/hooks/useTags';
import {
  enrichDownloadsWithTbm,
  buildDownloadHistoryLookup,
} from '@/components/downloads/utils/tbmDownloadEnrichment';

/**
 * Merges TorBox list items with backend tags and link-history flags.
 */
export function useDownloadsEnrichment(items, apiKey, isBackendAvailable) {
  const downloadHistory = useDownloadHistoryStore((state) => state.downloadHistory);

  const { loadTags, tags, loading: tagsLoading, updateTag: updateTagName } = useTags(apiKey);

  useEffect(() => {
    if (isBackendAvailable && apiKey && tags.length === 0 && !tagsLoading) {
      loadTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, isBackendAvailable]);

  const {
    fetchDownloadTags,
    mapTagsToDownloads,
    tagMappings,
    loading: downloadTagsLoading,
  } = useDownloadTags(apiKey);

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

  const downloadHistoryLookup = useMemo(
    () => buildDownloadHistoryLookup(downloadHistory),
    [downloadHistory]
  );

  const enrichedDownloads = useMemo(
    () => enrichDownloadsWithTbm(items, mapTagsToDownloads, downloadHistoryLookup),
    [items, tagMappings, mapTagsToDownloads, downloadHistoryLookup]
  );

  return {
    enrichedDownloads,
    downloadHistory,
    downloadHistoryLookup,
    tags,
    tagsLoading,
    updateTagName,
    tagMappings,
    downloadTagsLoading,
  };
}

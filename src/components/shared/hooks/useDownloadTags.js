'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDownloadTagsStore } from '@/store/downloadTagsStore';

/**
 * Hook for managing download-tag associations
 * Uses Zustand store for app-level state management
 */
export function useDownloadTags(apiKey) {
  const { tagMappings, loading, error, fetchDownloadTags, assignTags, setApiKey } =
    useDownloadTagsStore(
      useShallow((s) => ({
        tagMappings: s.tagMappings,
        loading: s.loading,
        error: s.error,
        fetchDownloadTags: s.fetchDownloadTags,
        assignTags: s.assignTags,
        setApiKey: s.setApiKey,
      }))
    );

  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  const fetchDownloadTagsWithKey = useCallback(async () => {
    if (apiKey) {
      await fetchDownloadTags(apiKey);
    }
  }, [apiKey, fetchDownloadTags]);

  const getDownloadTags = useCallback(
    (downloadId) => {
      return tagMappings[downloadId] || [];
    },
    [tagMappings]
  );

  const assignTagsWithKey = useCallback(
    async (downloadIds, tagIds, operation = 'add') => {
      if (!apiKey) {
        throw new Error('API key is required');
      }
      return await assignTags(apiKey, downloadIds, tagIds, operation);
    },
    [apiKey, assignTags]
  );

  const mapTagsToDownloads = useCallback(
    (downloads) => {
      if (!downloads || !Array.isArray(downloads)) {
        return downloads;
      }

      return downloads.map((download) => {
        const downloadId =
          download.id?.toString() ||
          download.torrent_id?.toString() ||
          download.usenet_id?.toString() ||
          download.web_id?.toString();
        const tags = getDownloadTags(downloadId);
        return {
          ...download,
          tags: tags || [],
        };
      });
    },
    [getDownloadTags]
  );

  const createTagLookupMap = useMemo(() => {
    const map = {};
    for (const [downloadId, tags] of Object.entries(tagMappings)) {
      map[downloadId] = new Set(tags.map((tag) => tag.id));
    }
    return map;
  }, [tagMappings]);

  const hasAnyTag = useCallback(
    (downloadId, tagIds) => {
      const downloadTagIds = createTagLookupMap[downloadId];
      if (!downloadTagIds) return false;
      return tagIds.some((tagId) => downloadTagIds.has(tagId));
    },
    [createTagLookupMap]
  );

  const hasAllTags = useCallback(
    (downloadId, tagIds) => {
      const downloadTagIds = createTagLookupMap[downloadId];
      if (!downloadTagIds) return false;
      return tagIds.every((tagId) => downloadTagIds.has(tagId));
    },
    [createTagLookupMap]
  );

  const hasNoneTags = useCallback(
    (downloadId, tagIds) => {
      const downloadTagIds = createTagLookupMap[downloadId];
      if (!downloadTagIds) return true;
      return !tagIds.some((tagId) => downloadTagIds.has(tagId));
    },
    [createTagLookupMap]
  );

  return {
    tagMappings,
    loading,
    error,
    fetchDownloadTags: fetchDownloadTagsWithKey,
    getDownloadTags,
    assignTags: assignTagsWithKey,
    mapTagsToDownloads,
    hasAnyTag,
    hasAllTags,
    hasNoneTags,
    createTagLookupMap,
  };
}

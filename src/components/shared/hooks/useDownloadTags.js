'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useDownloadTagsStore } from '@/store/downloadTagsStore';

/**
 * Hook for managing download-tag associations
 * Uses Zustand store for app-level state management
 */
export function useDownloadTags(apiKey) {
  const {
    tagMappings,
    loading,
    error,
    fetchDownloadTags,
    assignTags: assignTagsStore,
    setApiKey,
  } = useDownloadTagsStore();

  // Update API key in store when it changes (this will reset mappings if changed)
  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  /**
   * Fetch all download-tag mappings
   * Returns a map: { downloadId: [{ id, name }] }
   */
  const fetchDownloadTagsWithKey = useCallback(async () => {
    if (apiKey) {
      await fetchDownloadTags(apiKey);
    }
  }, [apiKey, fetchDownloadTags]);

  /**
   * Get tags for a specific download
   */
  const getDownloadTags = useCallback(
    (downloadId) => {
      return tagMappings[downloadId] || [];
    },
    [tagMappings],
  );

  /**
   * Assign tags to downloads (bulk operation)
   * @param {string[]} downloadIds - Array of download IDs
   * @param {number[]} tagIds - Array of tag IDs to assign
   * @param {string} operation - 'add', 'remove', or 'replace'
   */
  const assignTags = useCallback(
    async (downloadIds, tagIds, operation = 'add') => {
      if (!apiKey) {
        throw new Error('API key is required');
      }
      return await assignTagsStore(apiKey, downloadIds, tagIds, operation);
    },
    [apiKey, assignTagsStore],
  );

  /**
   * Map tags to download items
   * Takes an array of download items and adds tags property to each
   */
  const mapTagsToDownloads = useCallback((downloads) => {
    if (!downloads || !Array.isArray(downloads)) {
      return downloads;
    }

    return downloads.map(download => {
      const downloadId = download.id?.toString() || download.torrent_id?.toString() || 
                        download.usenet_id?.toString() || download.web_id?.toString();
      const tags = getDownloadTags(downloadId);
      return {
        ...download,
        tags: tags || [],
      };
    });
  }, [getDownloadTags]);

  /**
   * Create a lookup map for efficient filter evaluation
   * Returns: { downloadId: Set<tagId> }
   */
  const createTagLookupMap = useMemo(() => {
    const map = {};
    for (const [downloadId, tags] of Object.entries(tagMappings)) {
      map[downloadId] = new Set(tags.map(tag => tag.id));
    }
    return map;
  }, [tagMappings]);

  /**
   * Check if a download has any of the specified tags
   * Used for filter evaluation
   */
  const hasAnyTag = useCallback((downloadId, tagIds) => {
    const downloadTagIds = createTagLookupMap[downloadId];
    if (!downloadTagIds) return false;
    return tagIds.some(tagId => downloadTagIds.has(tagId));
  }, [createTagLookupMap]);

  /**
   * Check if a download has all of the specified tags
   */
  const hasAllTags = useCallback((downloadId, tagIds) => {
    const downloadTagIds = createTagLookupMap[downloadId];
    if (!downloadTagIds) return false;
    return tagIds.every(tagId => downloadTagIds.has(tagId));
  }, [createTagLookupMap]);

  /**
   * Check if a download has none of the specified tags
   */
  const hasNoneTags = useCallback((downloadId, tagIds) => {
    const downloadTagIds = createTagLookupMap[downloadId];
    if (!downloadTagIds) return true;
    return !tagIds.some(tagId => downloadTagIds.has(tagId));
  }, [createTagLookupMap]);

  return {
    tagMappings,
    loading,
    error,
    fetchDownloadTags: fetchDownloadTagsWithKey,
    getDownloadTags,
    assignTags,
    mapTagsToDownloads,
    hasAnyTag,
    hasAllTags,
    hasNoneTags,
    createTagLookupMap,
  };
}

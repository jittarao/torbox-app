'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * Hook for managing download-tag associations
 * Fetches all download-tag mappings in bulk and maintains in-memory map
 */
export function useDownloadTags(apiKey) {
  const [tagMappings, setTagMappings] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch all download-tag mappings
   * Returns a map: { downloadId: [{ id, name }] }
   */
  const fetchDownloadTags = useCallback(async () => {
    if (!apiKey) return;

    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/downloads/tags', window.location.origin);

      const response = await fetch(url.toString(), {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load download tags');
      }

      const data = await response.json();
      if (data.success) {
        setTagMappings(data.mappings || {});
        return data.mappings || {};
      } else {
        throw new Error(data.error || 'Failed to load download tags');
      }
    } catch (err) {
      console.error('Error loading download tags:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  /**
   * Get tags for a specific download
   */
  const getDownloadTags = useCallback((downloadId) => {
    return tagMappings[downloadId] || [];
  }, [tagMappings]);

  /**
   * Assign tags to downloads (bulk operation)
   * @param {string[]} downloadIds - Array of download IDs
   * @param {number[]} tagIds - Array of tag IDs to assign
   * @param {string} operation - 'add', 'remove', or 'replace'
   */
  const assignTags = useCallback(async (downloadIds, tagIds, operation = 'add') => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/downloads/tags', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          download_ids: downloadIds,
          tag_ids: tagIds,
          operation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to assign tags');
      }

      const data = await response.json();
      if (data.success) {
        // Refresh mappings after assignment
        await fetchDownloadTags();
        return true;
      } else {
        throw new Error(data.error || 'Failed to assign tags');
      }
    } catch (err) {
      console.error('Error assigning tags:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiKey, fetchDownloadTags]);

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
    fetchDownloadTags,
    getDownloadTags,
    assignTags,
    mapTagsToDownloads,
    hasAnyTag,
    hasAllTags,
    hasNoneTags,
    createTagLookupMap,
  };
}

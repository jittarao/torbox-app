'use client';

import { useEffect, useCallback } from 'react';
import { useTagsStore } from '@/store/tagsStore';

export function useTags(apiKey) {
  const { tags, loading, error, loadTags, createTag, updateTag, deleteTag, setApiKey } = useTagsStore();

  // Update API key in store when it changes (this will reset tags if changed)
  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  // Wrapper functions that pass apiKey to store actions
  const loadTagsWithKey = useCallback(async () => {
    if (apiKey) {
      await loadTags(apiKey);
    }
  }, [apiKey, loadTags]);

  const createTagWithKey = useCallback(async (name) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    return await createTag(apiKey, name);
  }, [apiKey, createTag]);

  const updateTagWithKey = useCallback(async (id, name) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    return await updateTag(apiKey, id, name);
  }, [apiKey, updateTag]);

  const deleteTagWithKey = useCallback(async (id) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    return await deleteTag(apiKey, id);
  }, [apiKey, deleteTag]);

  return {
    tags,
    loading,
    error,
    loadTags: loadTagsWithKey,
    createTag: createTagWithKey,
    updateTag: updateTagWithKey,
    deleteTag: deleteTagWithKey,
  };
}

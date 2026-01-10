'use client';

import { useEffect, useCallback } from 'react';
import { useCustomViewsStore } from '@/store/customViewsStore';

export function useCustomViews(apiKey) {
  const {
    views,
    activeView,
    loading,
    error,
    loadViews,
    saveView: saveViewStore,
    updateView: updateViewStore,
    deleteView: deleteViewStore,
    applyView: applyViewStore,
    clearView: clearViewStore,
    setApiKey,
  } = useCustomViewsStore();

  // Update API key in store when it changes (this will reset views if changed)
  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  // Wrapper functions that pass apiKey to store actions
  const loadViewsWithKey = useCallback(async () => {
    if (apiKey) {
      await loadViews(apiKey);
    }
  }, [apiKey, loadViews]);

  const saveView = useCallback(
    async (name, filters, sort, columns, assetType = null) => {
      if (!apiKey) {
        throw new Error('API key is required');
      }
      return await saveViewStore(apiKey, name, filters, sort, columns, assetType);
    },
    [apiKey, saveViewStore],
  );

  const updateView = useCallback(
    async (id, updates) => {
      if (!apiKey) {
        throw new Error('API key is required');
      }
      return await updateViewStore(apiKey, id, updates);
    },
    [apiKey, updateViewStore],
  );

  const deleteView = useCallback(
    async (id) => {
      if (!apiKey) {
        throw new Error('API key is required');
      }
      return await deleteViewStore(apiKey, id);
    },
    [apiKey, deleteViewStore],
  );

  return {
    views,
    activeView,
    loading,
    error,
    loadViews: loadViewsWithKey,
    saveView,
    updateView,
    deleteView,
    applyView: applyViewStore,
    clearView: clearViewStore,
  };
}

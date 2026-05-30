'use client';

import { useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCustomViewsStore } from '@/store/customViewsStore';

export function useCustomViews(apiKey) {
  const {
    views,
    activeView,
    loading,
    error,
    hasLoaded,
    loadViews,
    saveView: saveViewStore,
    updateView: updateViewStore,
    deleteView: deleteViewStore,
    applyView: applyViewStore,
    clearView: clearViewStore,
    setApiKey,
  } = useCustomViewsStore(
    useShallow((s) => ({
      views: s.views,
      activeView: s.activeView,
      loading: s.loading,
      error: s.error,
      hasLoaded: s.hasLoaded,
      loadViews: s.loadViews,
      saveView: s.saveView,
      updateView: s.updateView,
      deleteView: s.deleteView,
      applyView: s.applyView,
      clearView: s.clearView,
      setApiKey: s.setApiKey,
    }))
  );

  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  const loadViewsWithKey = useCallback(
    async (options) => {
      if (apiKey) {
        await loadViews(apiKey, options);
      }
    },
    [apiKey, loadViews]
  );

  const saveView = useCallback(
    async (name, filters, sort, columns, assetType = null, searchQuery = null) => {
      if (!apiKey) {
        throw new Error('API key is required');
      }
      return await saveViewStore(apiKey, name, filters, sort, columns, assetType, searchQuery);
    },
    [apiKey, saveViewStore]
  );

  const updateView = useCallback(
    async (id, updates) => {
      if (!apiKey) {
        throw new Error('API key is required');
      }
      return await updateViewStore(apiKey, id, updates);
    },
    [apiKey, updateViewStore]
  );

  const deleteView = useCallback(
    async (id) => {
      if (!apiKey) {
        throw new Error('API key is required');
      }
      return await deleteViewStore(apiKey, id);
    },
    [apiKey, deleteViewStore]
  );

  return {
    views,
    activeView,
    loading,
    error,
    hasLoaded,
    loadViews: loadViewsWithKey,
    saveView,
    updateView,
    deleteView,
    applyView: applyViewStore,
    clearView: clearViewStore,
  };
}

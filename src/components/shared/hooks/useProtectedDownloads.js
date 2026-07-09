'use client';

import { useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProtectedDownloadsStore } from '@/store/protectedDownloadsStore';

/**
 * Hook for managing per-download protection state.
 */
export function useProtectedDownloads(apiKey) {
  const {
    protectedMap,
    loading,
    error,
    hasLoaded,
    fetchProtectedDownloads,
    setProtected,
    setApiKey,
  } = useProtectedDownloadsStore(
    useShallow((s) => ({
      protectedMap: s.protectedMap,
      loading: s.loading,
      error: s.error,
      hasLoaded: s.hasLoaded,
      fetchProtectedDownloads: s.fetchProtectedDownloads,
      setProtected: s.setProtected,
      setApiKey: s.setApiKey,
    }))
  );

  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  const fetchProtectedDownloadsWithKey = useCallback(
    async (options) => {
      if (apiKey) {
        await fetchProtectedDownloads(apiKey, options);
      }
    },
    [apiKey, fetchProtectedDownloads]
  );

  const isDownloadProtected = useCallback(
    (downloadId) => {
      if (downloadId == null || downloadId === '') return false;
      return !!protectedMap[String(downloadId)];
    },
    [protectedMap]
  );

  const setProtectedWithKey = useCallback(
    async (downloadIds, isProtected) => {
      if (!apiKey) {
        throw new Error('API key is required');
      }
      return await setProtected(apiKey, downloadIds, isProtected);
    },
    [apiKey, setProtected]
  );

  return {
    protectedMap,
    loading,
    error,
    hasLoaded,
    fetchProtectedDownloads: fetchProtectedDownloadsWithKey,
    isDownloadProtected,
    setProtected: setProtectedWithKey,
  };
}

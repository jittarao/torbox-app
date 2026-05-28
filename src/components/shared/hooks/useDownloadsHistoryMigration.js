'use client';

import { useEffect, useRef } from 'react';
import { useDownloadHistoryStore } from '@/store/downloadHistoryStore';
import { migrateDownloadHistory } from '@/utils/migrateDownloadHistory';

/**
 * One-time link-history migration from localStorage + initial backend fetch.
 */
export function useDownloadsHistoryMigration(apiKey, isBackendAvailable, backendIsLoading) {
  const fetchDownloadHistory = useDownloadHistoryStore((state) => state.fetchDownloadHistory);
  const downloadHistory = useDownloadHistoryStore((state) => state.downloadHistory);
  const downloadHistoryLoading = useDownloadHistoryStore((state) => state.isLoading);
  const clearDownloadHistory = useDownloadHistoryStore((state) => state.clearDownloadHistory);

  const fetchDownloadHistoryRef = useRef(false);
  const migrationAttemptedRef = useRef(false);
  const previousApiKeyRef = useRef(null);

  useEffect(() => {
    if (backendIsLoading) {
      return;
    }

    const apiKeyChanged =
      previousApiKeyRef.current !== null && previousApiKeyRef.current !== apiKey;

    if (!apiKey) {
      fetchDownloadHistoryRef.current = false;
      migrationAttemptedRef.current = false;
      previousApiKeyRef.current = null;
      clearDownloadHistory();
      return;
    }

    if (apiKeyChanged) {
      fetchDownloadHistoryRef.current = false;
      migrationAttemptedRef.current = false;
      clearDownloadHistory();
    }

    previousApiKeyRef.current = apiKey;

    if (!isBackendAvailable) {
      return;
    }

    if (migrationAttemptedRef.current) {
      if (
        downloadHistory.length === 0 &&
        !downloadHistoryLoading &&
        !fetchDownloadHistoryRef.current
      ) {
        fetchDownloadHistoryRef.current = true;
        fetchDownloadHistory(apiKey);
      }
      return;
    }

    const runMigrationAndFetch = async () => {
      migrationAttemptedRef.current = true;

      const migrationResult = await migrateDownloadHistory(apiKey);
      if (migrationResult.success && migrationResult.migrated > 0) {
        console.log(`Migrated ${migrationResult.migrated} entries from localStorage`);
      }

      if (
        downloadHistory.length === 0 &&
        !downloadHistoryLoading &&
        !fetchDownloadHistoryRef.current
      ) {
        fetchDownloadHistoryRef.current = true;
        fetchDownloadHistory(apiKey);
      }
    };

    runMigrationAndFetch();
  }, [
    apiKey,
    downloadHistory.length,
    downloadHistoryLoading,
    fetchDownloadHistory,
    clearDownloadHistory,
    isBackendAvailable,
    backendIsLoading,
  ]);

  return { downloadHistory, fetchDownloadHistory };
}

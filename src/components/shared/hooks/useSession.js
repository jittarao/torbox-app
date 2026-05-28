'use client';

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSessionStore } from '@/store/sessionStore';

export function useSession() {
  const { apiKey, hydrated, permissions, permissionsLoading, hydrateFromStorage, setApiKey, loadPermissions } =
    useSessionStore(
      useShallow((s) => ({
        apiKey: s.apiKey,
        hydrated: s.hydrated,
        permissions: s.permissions,
        permissionsLoading: s.permissionsLoading,
        hydrateFromStorage: s.hydrateFromStorage,
        setApiKey: s.setApiKey,
        loadPermissions: s.loadPermissions,
      }))
    );

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (apiKey) {
      loadPermissions(apiKey);
    }
  }, [apiKey, loadPermissions]);

  return {
    apiKey,
    hydrated,
    permissions,
    permissionsLoading,
    setApiKey,
    loadPermissions,
  };
}

'use client';

import { useEffect } from 'react';
import { useSessionStore } from '@/store/sessionStore';

/**
 * Keeps session store + backend-scoped stores aligned with the route apiKey prop.
 * Mount once in AppShell.
 */
export function useSessionHydrate(apiKey) {
  const syncApiKey = useSessionStore((state) => state.syncApiKey);

  useEffect(() => {
    syncApiKey(apiKey);
  }, [apiKey, syncApiKey]);
}

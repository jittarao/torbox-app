'use client';

import { createContext, useContext } from 'react';

const DownloadsUIContext = createContext(null);

export function DownloadsUIProvider({ children, value }) {
  return <DownloadsUIContext.Provider value={value}>{children}</DownloadsUIContext.Provider>;
}

export function useDownloadsUIContext() {
  const ctx = useContext(DownloadsUIContext);
  if (!ctx) {
    throw new Error('useDownloadsUIContext must be used within DownloadsUIProvider');
  }
  return ctx;
}

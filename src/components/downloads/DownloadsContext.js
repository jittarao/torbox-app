'use client';

import { createContext, useContext } from 'react';

const DownloadsContext = createContext(null);

export function DownloadsProvider({ children, value }) {
  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}

export function useDownloadsContext() {
  const ctx = useContext(DownloadsContext);
  if (!ctx) {
    throw new Error('useDownloadsContext must be used within DownloadsProvider');
  }
  return ctx;
}

'use client';

import { createContext, useContext } from 'react';

const DownloadsDataContext = createContext(null);

export function DownloadsDataProvider({ children, value }) {
  return <DownloadsDataContext.Provider value={value}>{children}</DownloadsDataContext.Provider>;
}

export function useDownloadsDataContext() {
  const ctx = useContext(DownloadsDataContext);
  if (!ctx) {
    throw new Error('useDownloadsDataContext must be used within DownloadsDataProvider');
  }
  return ctx;
}

'use client';

import { createContext, useContext } from 'react';

const DownloadsFilterContext = createContext(null);

export function DownloadsFilterProvider({ children, value }) {
  return (
    <DownloadsFilterContext.Provider value={value}>{children}</DownloadsFilterContext.Provider>
  );
}

export function useDownloadsFilterContext() {
  const ctx = useContext(DownloadsFilterContext);
  if (!ctx) {
    throw new Error('useDownloadsFilterContext must be used within DownloadsFilterProvider');
  }
  return ctx;
}

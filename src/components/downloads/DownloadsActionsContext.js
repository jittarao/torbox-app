'use client';

import { createContext, useContext } from 'react';

const DownloadsActionsContext = createContext(null);

export function DownloadsActionsProvider({ value, children }) {
  return (
    <DownloadsActionsContext.Provider value={value}>{children}</DownloadsActionsContext.Provider>
  );
}

export function useDownloadsActions() {
  const context = useContext(DownloadsActionsContext);
  if (!context) {
    throw new Error('useDownloadsActions must be used within DownloadsActionsProvider');
  }
  return context;
}

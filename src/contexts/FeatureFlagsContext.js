'use client';

import { createContext, useContext } from 'react';

const FeatureFlagsContext = createContext({ searchPageDisabled: false });

export function FeatureFlagsProvider({ searchPageDisabled = false, children }) {
  return (
    <FeatureFlagsContext.Provider value={{ searchPageDisabled: !!searchPageDisabled }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

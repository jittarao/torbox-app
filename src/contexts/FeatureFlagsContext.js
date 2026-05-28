'use client';

import { createContext, use, useMemo } from 'react';

const FeatureFlagsContext = createContext({ searchPageDisabled: false });

export function FeatureFlagsProvider({ searchPageDisabled = false, children }) {
  const value = useMemo(() => ({ searchPageDisabled: !!searchPageDisabled }), [searchPageDisabled]);
  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags() {
  return use(FeatureFlagsContext);
}

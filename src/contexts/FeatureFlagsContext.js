'use client';

import { createContext, use, useMemo } from 'react';

const FeatureFlagsContext = createContext({
  searchPageDisabled: false,
  onboardingAuxActive: false,
});

export function FeatureFlagsProvider({
  searchPageDisabled = false,
  onboardingAuxActive = false,
  children,
}) {
  const value = useMemo(
    () => ({
      searchPageDisabled: !!searchPageDisabled,
      onboardingAuxActive: !!onboardingAuxActive,
    }),
    [searchPageDisabled, onboardingAuxActive]
  );
  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags() {
  return use(FeatureFlagsContext);
}

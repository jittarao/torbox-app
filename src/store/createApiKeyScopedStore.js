/**
 * Shared currentApiKey + setApiKey slice for backend-scoped Zustand stores.
 * @param {Record<string, unknown>} resetOnKeyChange - state reset when api key changes
 */
export function createApiKeyScopedSlice(set, get, resetOnKeyChange = {}) {
  return {
    currentApiKey: null,
    setApiKey: (apiKey) => {
      const { currentApiKey } = get();
      if (currentApiKey !== apiKey) {
        set({ currentApiKey: apiKey, ...resetOnKeyChange });
      }
    },
  };
}

/**
 * Shared currentApiKey + setApiKey slice for backend-scoped Zustand stores.
 * @param {Record<string, unknown>} resetOnKeyChange - state reset when api key changes
 */
export function createApiKeyScopedSlice(set, get, resetOnKeyChange = {}) {
  return {
    currentApiKey: null,
    activeRequestId: 0,
    setApiKey: (apiKey) => {
      const { currentApiKey } = get();
      if (currentApiKey !== apiKey) {
        set({
          currentApiKey: apiKey,
          activeRequestId: get().activeRequestId + 1,
          ...resetOnKeyChange,
        });
      }
    },
    isRequestCurrent: (apiKey, requestId) =>
      get().activeRequestId === requestId && get().currentApiKey === apiKey,
  };
}

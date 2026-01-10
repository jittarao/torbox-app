import { create } from 'zustand';

/**
 * General app-level store for tracking global state
 * Currently tracks which API keys have ensured their database
 */
export const useAppStore = create((set, get) => ({
  // Track which API keys have ensured their database
  ensuredDbKeys: new Set(), // Set of API keys that have ensured DB
  ensuringDb: new Set(), // Set of API keys currently ensuring DB

  // Check if database has been ensured for an API key
  isDbEnsured: (apiKey) => {
    return get().ensuredDbKeys.has(apiKey);
  },

  // Check if database is currently being ensured for an API key
  isEnsuringDb: (apiKey) => {
    return get().ensuringDb.has(apiKey);
  },

  // Mark that database is being ensured
  setEnsuringDb: (apiKey, isEnsuring) => {
    const { ensuringDb } = get();
    if (isEnsuring) {
      ensuringDb.add(apiKey);
    } else {
      ensuringDb.delete(apiKey);
    }
    set({ ensuringDb: new Set(ensuringDb) });
  },

  // Mark that database has been ensured for an API key
  markDbEnsured: (apiKey) => {
    const { ensuredDbKeys } = get();
    ensuredDbKeys.add(apiKey);
    set({ ensuredDbKeys: new Set(ensuredDbKeys) });
  },

  // Clear ensured keys (useful when API key changes)
  clearEnsuredDbKeys: () => {
    set({ ensuredDbKeys: new Set(), ensuringDb: new Set() });
  },
}));

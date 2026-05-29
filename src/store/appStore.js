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
    const next = new Set(ensuringDb);
    isEnsuring ? next.add(apiKey) : next.delete(apiKey);
    set({ ensuringDb: next });
  },

  // Mark that database has been ensured for an API key
  markDbEnsured: (apiKey) => {
    const { ensuredDbKeys } = get();
    const next = new Set(ensuredDbKeys);
    next.add(apiKey);
    set({ ensuredDbKeys: next });
  },

  // Clear ensured keys (useful when API key changes)
  clearEnsuredDbKeys: () => {
    set({ ensuredDbKeys: new Set(), ensuringDb: new Set() });
  },
}));

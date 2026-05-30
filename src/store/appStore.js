import { create } from 'zustand';

const MAX_KEYS = 50;

function withMax(set) {
  if (set.size > MAX_KEYS) {
    const first = set.values().next().value;
    if (first !== undefined) set.delete(first);
  }
  return set;
}

export const useAppStore = create((set, get) => ({
  ensuredDbKeys: new Set(),
  ensuringDb: new Set(),

  isDbEnsured: (apiKey) => get().ensuredDbKeys.has(apiKey),

  isEnsuringDb: (apiKey) => get().ensuringDb.has(apiKey),

  setEnsuringDb: (apiKey, value) => {
    set((state) => {
      const next = new Set(state.ensuringDb);
      value ? next.add(apiKey) : next.delete(apiKey);
      return { ensuringDb: withMax(next) };
    });
  },

  markDbEnsured: (apiKey) => {
    set((state) => {
      const next = new Set(state.ensuredDbKeys);
      next.add(apiKey);
      return { ensuredDbKeys: withMax(next) };
    });
  },

  clearEnsuredDbKeys: () => {
    set(() => ({
      ensuredDbKeys: new Set(),
      ensuringDb: new Set(),
    }));
  },
}));

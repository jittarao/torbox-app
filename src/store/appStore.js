import { create } from 'zustand';

const MAX_KEYS = 50;

export const useAppStore = create(() => ({
  ensuredDbKeys: new Set(),
  ensuringDb: new Set(),
}));

function withMax(set) {
  if (set.size > MAX_KEYS) {
    const first = set.values().next().value;
    if (first !== undefined) set.delete(first);
  }
  return set;
}

export function isDbEnsured(apiKey) {
  return useAppStore.getState().ensuredDbKeys.has(apiKey);
}

export function isEnsuringDb(apiKey) {
  return useAppStore.getState().ensuringDb.has(apiKey);
}

export function setEnsuringDb(apiKey, value) {
  useAppStore.setState((state) => {
    const next = new Set(state.ensuringDb);
    value ? next.add(apiKey) : next.delete(apiKey);
    return { ensuringDb: withMax(next) };
  });
}

export function markDbEnsured(apiKey) {
  useAppStore.setState((state) => {
    const next = new Set(state.ensuredDbKeys);
    next.add(apiKey);
    return { ensuredDbKeys: withMax(next) };
  });
}

export function clearEnsuredDbKeys() {
  useAppStore.setState(() => ({
    ensuredDbKeys: new Set(),
    ensuringDb: new Set(),
  }));
}

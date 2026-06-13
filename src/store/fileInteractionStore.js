import { create } from 'zustand';

/**
 * Per-file interaction state (downloading, copying, streaming).
 * Each file row subscribes to its own status key, so only the affected
 * row re-renders when an action starts/completes — not all 500 file rows.
 */
export const useFileInteractionStore = create((set, get) => ({
  isDownloading: {},
  isCopying: {},
  isStreaming: {},

  setDownloading: (key, value) =>
    set((state) => ({
      isDownloading: { ...state.isDownloading, [key]: value },
    })),

  setCopying: (key, value) =>
    set((state) => ({
      isCopying: { ...state.isCopying, [key]: value },
    })),

  setStreaming: (key, value) =>
    set((state) => ({
      isStreaming: { ...state.isStreaming, [key]: value },
    })),

  clearAll: () => set({ isDownloading: {}, isCopying: {}, isStreaming: {} }),
}));

/** Granular selector — subscribes to ONE file's status. */
export function selectIsFileDownloading(key) {
  return (state) => state.isDownloading[key] ?? false;
}

export function selectIsFileCopying(key) {
  return (state) => state.isCopying[key] ?? false;
}

export function selectIsFileStreaming(key) {
  return (state) => state.isStreaming[key] ?? false;
}

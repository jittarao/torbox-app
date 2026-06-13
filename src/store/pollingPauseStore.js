import { create } from 'zustand';

export const selectIsPaused = (state) => Object.values(state.pauseReasons).some(Boolean);

export const usePollingPauseStore = create((set) => ({
  pauseReasons: {},

  setPauseReason: (reason, isPaused) => {
    set((state) => {
      const next = { ...state.pauseReasons, [reason]: isPaused };
      return { pauseReasons: next };
    });
  },

  clearPauseReason: (reason) => {
    set((state) => {
      const next = { ...state.pauseReasons };
      delete next[reason];
      return { pauseReasons: next };
    });
  },

  clearAllPauseReasons: () => {
    set({ pauseReasons: {} });
  },
}));

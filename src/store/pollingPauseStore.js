import { create } from 'zustand';

function computeIsPaused(pauseReasons) {
  return Object.values(pauseReasons).some((isPaused) => isPaused === true);
}

export const usePollingPauseStore = create((set) => ({
  pauseReasons: {},
  isPaused: false,

  setPauseReason: (reason, isPaused) => {
    set((state) => {
      const next = { ...state.pauseReasons, [reason]: isPaused };
      return { pauseReasons: next, isPaused: computeIsPaused(next) };
    });
  },

  clearPauseReason: (reason) => {
    set((state) => {
      const next = { ...state.pauseReasons };
      delete next[reason];
      return { pauseReasons: next, isPaused: computeIsPaused(next) };
    });
  },

  clearAllPauseReasons: () => {
    set({ pauseReasons: {}, isPaused: false });
  },
}));

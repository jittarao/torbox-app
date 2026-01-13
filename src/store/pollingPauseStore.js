import { create } from 'zustand';

/**
 * Generic polling pause store
 * Allows multiple components to pause polling for different reasons
 * Polling is paused if ANY reason is active
 */
export const usePollingPauseStore = create((set, get) => ({
  // Map of pause reasons: { reason: boolean }
  pauseReasons: {},

  /**
   * Set a pause reason (e.g., 'videoPlayer', 'modal', etc.)
   * @param {string} reason - The reason for pausing
   * @param {boolean} isPaused - Whether to pause or resume
   */
  setPauseReason: (reason, isPaused) => {
    set((state) => ({
      pauseReasons: {
        ...state.pauseReasons,
        [reason]: isPaused,
      },
    }));
  },

  /**
   * Check if polling should be paused (true if ANY reason is active)
   * @returns {boolean} - True if polling should be paused
   */
  isPollingPaused: () => {
    const { pauseReasons } = get();
    return Object.values(pauseReasons).some((isPaused) => isPaused === true);
  },

  /**
   * Clear a specific pause reason
   * @param {string} reason - The reason to clear
   */
  clearPauseReason: (reason) => {
    set((state) => {
      const newReasons = { ...state.pauseReasons };
      delete newReasons[reason];
      return { pauseReasons: newReasons };
    });
  },

  /**
   * Clear all pause reasons
   */
  clearAllPauseReasons: () => {
    set({ pauseReasons: {} });
  },
}));

import { create } from 'zustand';

/** @type {Set<(immediateRefresh?: boolean) => void>} */
const reEngagedListeners = new Set();
/** @type {Set<() => void>} */
const disengagedListeners = new Set();

const initialIsVisible =
  typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

export const useUserPresenceStore = create((set, get) => ({
  isVisible: initialIsVisible,
  isUserIdle: false,
  desktopDisengaged: false,
  awaySince: initialIsVisible ? null : Date.now(),
  wasDisengaged: !initialIsVisible,

  setPresence: (partial) => set(partial),

  getSnapshot: () => {
    const state = get();
    return {
      isVisible: () => state.isVisible,
      isUserIdle: () => state.isUserIdle,
      wasDisengaged: () => state.wasDisengaged,
      awaySince: () => state.awaySince,
      isDisengaged: () => !state.isVisible || state.isUserIdle || state.desktopDisengaged,
    };
  },

  subscribeReEngaged: (listener) => {
    reEngagedListeners.add(listener);
    return () => reEngagedListeners.delete(listener);
  },

  subscribeDisengaged: (listener) => {
    disengagedListeners.add(listener);
    return () => disengagedListeners.delete(listener);
  },

  notifyReEngaged: (immediateRefresh) => {
    reEngagedListeners.forEach((listener) => listener(immediateRefresh));
  },

  notifyDisengaged: () => {
    disengagedListeners.forEach((listener) => listener());
  },
}));

export function getUserPresenceSnapshot() {
  return useUserPresenceStore.getState().getSnapshot();
}

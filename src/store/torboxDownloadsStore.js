import { create } from 'zustand';
import { getListKeyForAssetType } from '@/store/torboxDownloadsSelectors';

const initialMeta = {
  loading: true,
  error: null,
  lastSuccessfulFetchAt: null,
  refreshBlockedReason: null,
  pollSchedule: null,
  canManualRefresh: true,
};

/**
 * TorBox API download lists (torrents / usenet / webdl) and fetch metadata.
 * Derived view state (filters, sort) stays in Downloads.js.
 */
export const useTorboxDownloadsStore = create((set, get) => ({
  torrents: [],
  usenet: [],
  webdl: [],
  ...initialMeta,

  setTorrents: (torrents) => set({ torrents }),
  setUsenet: (usenet) => set({ usenet }),
  setWebdl: (webdl) => set({ webdl }),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setLastSuccessfulFetchAt: (lastSuccessfulFetchAt) => set({ lastSuccessfulFetchAt }),
  setRefreshBlockedReason: (refreshBlockedReason) => set({ refreshBlockedReason }),
  setPollSchedule: (pollSchedule) => set({ pollSchedule }),
  setCanManualRefresh: (canManualRefresh) => set({ canManualRefresh }),

  markFetchSuccess: () =>
    set({
      lastSuccessfulFetchAt: Date.now(),
      refreshBlockedReason: null,
    }),

  markRateLimited: () =>
    set({
      refreshBlockedReason: 'rate_limited',
      canManualRefresh: false,
    }),

  dismissError: () => set({ error: null }),

  resetForApiKey: (hasApiKey) =>
    set({
      torrents: [],
      usenet: [],
      webdl: [],
      loading: !!hasApiKey,
      error: null,
      lastSuccessfulFetchAt: null,
      refreshBlockedReason: null,
      pollSchedule: null,
      canManualRefresh: true,
    }),

  /**
   * @param {'torrents' | 'usenet' | 'webdl'} assetType
   * @param {(prev: object[]) => object[]} updater
   */
  updateList: (assetType, updater) => {
    const key = getListKeyForAssetType(assetType);
    const prev = get()[key] || [];
    const next = updater(prev);
    set({ [key]: next });
  },

  /**
   * @param {'torrents' | 'usenet' | 'webdl'} assetType
   * @param {(number|string)[]} ids
   */
  removeByIds: (assetType, ids) => {
    const idSet = new Set(ids);
    get().updateList(assetType, (prev) => prev.filter((item) => !idSet.has(item.id)));
  },

  /**
   * Optimistic patch for a single row.
   * @param {'torrents' | 'usenet' | 'webdl'} assetType
   * @param {number|string} id
   * @param {object} partial
   */
  patchItem: (assetType, id, partial) => {
    get().updateList(assetType, (prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...partial } : item))
    );
  },
}));

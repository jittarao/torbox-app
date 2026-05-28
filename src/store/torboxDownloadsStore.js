import { create } from 'zustand';
import { downloadRowEqual, mergeListIntoEntities } from '@/utils/downloadListMerge';
import {
  entityKey,
  getListKeyForAssetType,
  selectItemsForView,
} from '@/store/torboxDownloadsSelectors';

const initialMeta = {
  loading: true,
  error: null,
  lastSuccessfulFetchAt: null,
  refreshBlockedReason: null,
  pollSchedule: null,
  canManualRefresh: true,
};

const emptyOrder = { torrents: [], usenet: [], webdl: [] };

/**
 * TorBox API download lists (normalized entities + order) and fetch metadata.
 */
export const useTorboxDownloadsStore = create((set, get) => ({
  /** @type {Record<string, object>} */
  entities: {},
  order: { ...emptyOrder },
  ...initialMeta,

  /**
   * @param {'torrents' | 'usenet' | 'webdl'} assetType
   * @param {object[]} mergedList — output of mergeDownloadList
   */
  applyListMerge: (assetType, mergedList) => {
    const listKey = getListKeyForAssetType(assetType);
    const state = get();
    const prevOrder = state.order[listKey] || [];
    const { entities, orderKeys } = mergeListIntoEntities(
      state.entities,
      prevOrder,
      mergedList,
      assetType
    );
    get().setListFromMerge(assetType, entities, orderKeys);
  },

  /**
   * Apply pre-merged entities + order keys for one asset type (fetch path).
   */
  setListFromMerge: (assetType, entities, orderKeys) => {
    const listKey = getListKeyForAssetType(assetType);
    const state = get();
    set({
      entities,
      order: { ...state.order, [listKey]: orderKeys },
    });
  },

  /** @deprecated Use applyListMerge — kept for callers that still pass arrays */
  setTorrents: (torrents) => get().applyListMerge('torrents', torrents || []),
  setUsenet: (usenet) => get().applyListMerge('usenet', usenet || []),
  setWebdl: (webdl) => get().applyListMerge('webdl', webdl || []),

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
      entities: {},
      order: { ...emptyOrder },
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
    const listKey = getListKeyForAssetType(assetType);
    const prev = selectItemsForView(get(), assetType === 'usenet' ? 'usenet' : assetType === 'webdl' ? 'webdl' : 'torrents');
    const next = updater(prev);
    get().applyListMerge(assetType, next);
  },

  /**
   * @param {'torrents' | 'usenet' | 'webdl'} assetType
   * @param {(number|string)[]} ids
   */
  removeByIds: (assetType, ids) => {
    const idSet = new Set(ids);
    const listKey = getListKeyForAssetType(assetType);
    const state = get();
    const prevOrder = state.order[listKey] || [];
    const nextOrder = prevOrder.filter((key) => {
      const row = state.entities[key];
      return row && !idSet.has(row.id);
    });
    const nextEntities = { ...state.entities };
    for (const key of prevOrder) {
      const row = state.entities[key];
      if (row && idSet.has(row.id)) {
        delete nextEntities[key];
      }
    }

    set({
      entities: nextEntities,
      order: { ...state.order, [listKey]: nextOrder },
    });
  },

  /**
   * @param {'torrents' | 'usenet' | 'webdl'} assetType
   * @param {number|string} id
   * @param {object} partial
   */
  patchItem: (assetType, id, partial) => {
    const key = entityKey(assetType, id);
    const state = get();
    const prev = state.entities[key];
    if (!prev) return;

    const nextRow = { ...prev, ...partial };
    const listKey = getListKeyForAssetType(assetType);
    const storedRow =
      downloadRowEqual(prev, nextRow) ? prev : nextRow;

    set({
      entities: { ...state.entities, [key]: storedRow },
    });
  },
}));

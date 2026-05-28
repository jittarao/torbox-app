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

function rowsFromOrder(entities, orderKeys) {
  const rows = [];
  for (let i = 0; i < orderKeys.length; i++) {
    const row = entities[orderKeys[i]];
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * TorBox API download lists (normalized entities + order) and fetch metadata.
 */
export const useTorboxDownloadsStore = create((set, get) => ({
  /** @type {Record<string, object>} */
  entities: {},
  order: { ...emptyOrder },
  /** @deprecated Compatibility arrays — kept in sync with entities/order */
  torrents: [],
  usenet: [],
  webdl: [],
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
      [listKey]: rowsFromOrder(entities, orderKeys),
    });
  },

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
      [listKey]: rowsFromOrder(nextEntities, nextOrder),
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
      [listKey]: (state[listKey] || []).map((item) =>
        item.id === id ? storedRow : item
      ),
    });
  },
}));

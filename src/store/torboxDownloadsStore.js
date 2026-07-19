import { create } from 'zustand';
import { downloadRowEqual, mergeListIntoEntities } from '@/utils/downloadListMerge';
import { slimRowForStorage } from '@/utils/downloadEntityFiles';
import {
  entityKey,
  getListKeyForAssetType,
  selectHasQueuedTorrents,
  selectItemsForView,
} from '@/store/torboxDownloadsSelectors';

export { selectHasQueuedTorrents };

const initialMeta = {
  loading: true,
  refreshing: false,
  error: null,
  lastSuccessfulFetchAt: null,
  refreshBlockedReason: null,
  pollSchedule: null,
  canManualRefresh: true,
};

const emptyOrder = { torrents: [], usenet: [], webdl: [] };

function pollScheduleEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.mode === b.mode && a.nextPollAt === b.nextPollAt && a.intervalMs === b.intervalMs;
}

/**
 * TorBox API download lists (normalized entities + order) and fetch metadata.
 */
export const useTorboxDownloadsStore = create((set, get) => ({
  /** @type {Record<string, object>} */
  entities: {},
  /** @type {Record<string, object[]>} */
  filesByEntityKey: {},
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
    const { entities, orderKeys, filesCache } = mergeListIntoEntities(
      state.entities,
      prevOrder,
      mergedList,
      assetType,
      state.filesByEntityKey
    );
    get().setListFromMerge(assetType, entities, orderKeys, filesCache);
  },

  /**
   * Apply pre-merged entities + order keys for one asset type (fetch path).
   */
  setListFromMerge: (assetType, entities, orderKeys, filesCache) => {
    const listKey = getListKeyForAssetType(assetType);
    const state = get();
    const prevOrder = state.order[listKey] || [];
    const nextFilesCache = filesCache ?? state.filesByEntityKey;

    if (
      prevOrder.length === orderKeys.length &&
      prevOrder.every((key, index) => key === orderKeys[index])
    ) {
      let rowsUnchanged = true;
      for (let i = 0; i < orderKeys.length; i++) {
        const key = orderKeys[i];
        if (state.entities[key] !== entities[key]) {
          rowsUnchanged = false;
          break;
        }
      }
      if (rowsUnchanged && nextFilesCache === state.filesByEntityKey) {
        return;
      }
    }

    set({
      entities,
      filesByEntityKey: nextFilesCache,
      order: { ...state.order, [listKey]: orderKeys },
    });
  },

  setLoading: (loading) => set({ loading }),
  setRefreshing: (refreshing) => set({ refreshing }),
  setError: (error) => set({ error }),
  setLastSuccessfulFetchAt: (lastSuccessfulFetchAt) => set({ lastSuccessfulFetchAt }),
  setRefreshBlockedReason: (refreshBlockedReason) => set({ refreshBlockedReason }),
  setPollSchedule: (pollSchedule) => {
    if (pollScheduleEqual(get().pollSchedule, pollSchedule)) return;
    set({ pollSchedule });
  },
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
      filesByEntityKey: {},
      order: { ...emptyOrder },
      loading: !!hasApiKey,
      refreshing: false,
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
    const prev = selectItemsForView(
      get(),
      assetType === 'usenet' ? 'usenet' : assetType === 'webdl' ? 'webdl' : 'torrents'
    );
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
    const nextFilesCache = { ...state.filesByEntityKey };
    for (const key of prevOrder) {
      const row = state.entities[key];
      if (row && idSet.has(row.id)) {
        delete nextEntities[key];
        delete nextFilesCache[key];
      }
    }

    set({
      entities: nextEntities,
      filesByEntityKey: nextFilesCache,
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
    let storedRow = downloadRowEqual(prev, nextRow) ? prev : nextRow;
    let nextFilesCache = state.filesByEntityKey;

    if (partial.files !== undefined) {
      const { slim, files } = slimRowForStorage(storedRow);
      storedRow = downloadRowEqual(prev, slim) ? prev : slim;
      const prevCached = state.filesByEntityKey[key];

      if (files?.length) {
        const nextFiles =
          prev?.fileListSignature === slim.fileListSignature && prevCached ? prevCached : files;
        if (prevCached !== nextFiles) {
          nextFilesCache = { ...state.filesByEntityKey, [key]: nextFiles };
        }
      } else if (key in state.filesByEntityKey) {
        nextFilesCache = { ...state.filesByEntityKey };
        delete nextFilesCache[key];
      }
    }

    set({
      entities: { ...state.entities, [key]: storedRow },
      ...(nextFilesCache !== state.filesByEntityKey ? { filesByEntityKey: nextFilesCache } : {}),
    });
  },
}));

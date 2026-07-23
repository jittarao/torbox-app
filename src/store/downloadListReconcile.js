import { POLLING_CONFIG } from '@/components/shared/hooks/pollingConfig';
import { fetchDownloadType } from '@/store/torboxDownloadsFetch';
import { resetPollTimer } from '@/store/pollTimerReset';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';

/** @type {{ apiKey: string | null, viewType: string | null }} */
let syncContext = { apiKey: null, viewType: null };

/** @type {Set<'torrents' | 'usenet' | 'webdl'>} */
const pendingAssetTypes = new Set();

/** @type {ReturnType<typeof setTimeout> | null} */
let debounceTimerId = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let initialDelayTimerId = null;

export function registerDownloadsSyncContext({ apiKey, viewType }) {
  syncContext = { apiKey, viewType };
}

export function unregisterDownloadsSyncContext() {
  syncContext = { apiKey: null, viewType: null };
  cancelScheduledReconcile();
}

/** @internal — test helper */
export function cancelScheduledReconcile() {
  if (debounceTimerId != null) {
    clearTimeout(debounceTimerId);
    debounceTimerId = null;
  }
  if (initialDelayTimerId != null) {
    clearTimeout(initialDelayTimerId);
    initialDelayTimerId = null;
  }
  pendingAssetTypes.clear();
}

async function runReconcileFetch(assetTypes) {
  const { apiKey, viewType } = syncContext;
  if (!apiKey || !viewType) return;

  await Promise.all(
    assetTypes.map((assetType) =>
      fetchDownloadType(apiKey, assetType, viewType, {
        skipLoading: true,
        forMutation: true,
      })
    )
  );
}

/**
 * Schedule a debounced, delayed list refetch after force-start / auto-start.
 * Trailing debounce coalesces rapid actions; initial delay waits for TorBox queue→list move.
 *
 * @param {Array<'torrents' | 'usenet' | 'webdl'>} assetTypes
 * @param {{ initialDelayMs?: number, debounceMs?: number }} [options]
 */
export function scheduleDelayedDownloadsReconcile(
  assetTypes,
  {
    initialDelayMs = POLLING_CONFIG.forceStartReconcileDelayMs,
    debounceMs = POLLING_CONFIG.forceStartReconcileDebounceMs,
  } = {}
) {
  if (!assetTypes?.length) return;

  // Postpone an imminent poll tick so the delayed reconcile fetch is not duplicated.
  resetPollTimer();

  for (const assetType of assetTypes) {
    pendingAssetTypes.add(assetType);
  }

  if (debounceTimerId != null) {
    clearTimeout(debounceTimerId);
  }

  debounceTimerId = setTimeout(() => {
    debounceTimerId = null;

    // Keep accumulating types in pendingAssetTypes until the initial delay elapses.
    // Do not reset an in-flight initial delay — new types join the same reconcile batch.
    if (initialDelayTimerId != null) return;

    initialDelayTimerId = setTimeout(() => {
      initialDelayTimerId = null;
      const types = [...pendingAssetTypes];
      pendingAssetTypes.clear();
      if (types.length > 0) {
        runReconcileFetch(types);
      }
    }, initialDelayMs);
  }, debounceMs);
}

/**
 * After a successful controlqueued `start` (manual force start, bulk, or auto-start).
 * @param {'torrents' | 'usenet' | 'webdl' | Array<'torrents' | 'usenet' | 'webdl'>} assetTypeOrTypes
 */
export function scheduleForceStartReconcile(assetTypeOrTypes) {
  const types = Array.isArray(assetTypeOrTypes) ? assetTypeOrTypes : [assetTypeOrTypes];
  scheduleDelayedDownloadsReconcile(types);
}

/**
 * Remove queued row(s) after a successful force-start, then schedule authoritative reconcile.
 *
 * @param {'torrents' | 'usenet' | 'webdl'} assetType
 * @param {(number|string)[]} ids
 */
export function removeQueuedAfterForceStart(assetType, ids) {
  if (!ids?.length) return;
  useTorboxDownloadsStore.getState().removeByIds(assetType, ids);
  scheduleForceStartReconcile(assetType);
}

/**
 * @param {Partial<Record<'torrents' | 'usenet' | 'webdl', (number|string)[]>>} idsByAssetType
 */
export function removeQueuedAfterForceStartBulk(idsByAssetType) {
  const reconcileTypes = [];
  const store = useTorboxDownloadsStore.getState();

  for (const assetType of ['torrents', 'usenet', 'webdl']) {
    const ids = idsByAssetType[assetType];
    if (!ids?.length) continue;
    store.removeByIds(assetType, ids);
    reconcileTypes.push(assetType);
  }

  if (reconcileTypes.length > 0) {
    scheduleForceStartReconcile(reconcileTypes);
  }
}

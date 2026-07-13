import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import zlib from 'zlib';

const fetchFullDownloadListMock = mock(async () => ({
  success: true,
  data: [],
  pageCount: 0,
}));
const fetchShallowDownloadListMock = mock(async () => shallowResult([]));

const API_KEY = 'test-api-key-sync';
const TYPE = 'torrents';

function item(id, added, extra = {}) {
  return { id, added, created_at: added, name: `item-${id}`, ...extra };
}

function shallowResult(data, { regularPageLength } = {}) {
  const regularCount =
    regularPageLength ?? (data || []).filter((row) => row.status !== 'queued').length;
  return {
    success: true,
    data: data || [],
    regularPageLength: regularCount,
  };
}

function parseCompressedBody(buffer) {
  return JSON.parse(zlib.gunzipSync(buffer).toString('utf8'));
}

describe('downloadListSync', () => {
  let applyShallowPatch;
  let applySinglePageShallowMerge;
  let computeDelta;
  let getDownloadListSyncCacheEntry;
  let handleListSyncRequest;
  let isSinglePageCatalog;
  let isMultiPageFromFullReconcile;
  let patchCacheRemoveIds;
  let resetDownloadListSyncForTests;
  let runFullReconciliation;
  let runShallowRefresh;
  let ensureShallowRefreshIfStale;
  let scheduleBackgroundReconcileIfDue;
  let setDownloadListSyncCacheForTests;
  let setDownloadListSyncCacheMetaForTests;
  let flushMutationReconcileTimerForTests;
  let clearDownloadListSyncCacheOnlyForTests;
  let reconcileFailureBackoffMs;
  let shallowFailureBackoffMs;

  beforeEach(async () => {
    mock.module('@/app/api/lib/fetchTorboxDownloadList', () => ({
      MYLIST_PAGE_LIMIT: 1000,
      fetchFullDownloadList: (...args) => fetchFullDownloadListMock(...args),
      fetchShallowDownloadList: (...args) => fetchShallowDownloadListMock(...args),
      sortByAddedDesc: (items) =>
        [...(items || [])].sort(
          (a, b) =>
            new Date(b.added ?? b.created_at ?? 0).getTime() -
            new Date(a.added ?? a.created_at ?? 0).getTime()
        ),
    }));

    ({
      applyShallowPatch,
      applySinglePageShallowMerge,
      computeDelta,
      getDownloadListSyncCacheEntry,
      handleListSyncRequest,
      isSinglePageCatalog,
      isMultiPageFromFullReconcile,
      patchCacheRemoveIds,
      resetDownloadListSyncForTests,
      runFullReconciliation,
      runShallowRefresh,
      ensureShallowRefreshIfStale,
      scheduleBackgroundReconcileIfDue,
      setDownloadListSyncCacheForTests,
      setDownloadListSyncCacheMetaForTests,
      flushMutationReconcileTimerForTests,
      clearDownloadListSyncCacheOnlyForTests,
      reconcileFailureBackoffMs,
      shallowFailureBackoffMs,
    } = await import('../downloadListSync.js'));

    fetchFullDownloadListMock.mockReset();
    fetchShallowDownloadListMock.mockReset();
    await resetDownloadListSyncForTests();
  });

  afterEach(() => {
    mock.restore();
  });

  describe('helpers', () => {
    test('applyShallowPatch updates existing rows and inserts new ones without removing tail', () => {
      const authoritative = [item(1, '2020-01-03'), item(1500, '2020-01-01')];
      const partial = [item(1, '2020-01-03', { progress: 0.5 }), item(2, '2020-01-04')];

      const patched = applyShallowPatch(authoritative, partial);

      expect(patched.map((row) => row.id)).toEqual([2, 1, 1500]);
      expect(patched.find((row) => row.id === 1).progress).toBe(0.5);
      expect(patched.find((row) => row.id === 1500)).toBeTruthy();
    });

    test('applySinglePageShallowMerge replaces the catalog and allows removals', () => {
      const partial = [item(1, '2020-01-02', { progress: 0.5 })];
      const merged = applySinglePageShallowMerge(partial);

      expect(merged.map((row) => row.id)).toEqual([1]);
      expect(merged[0].progress).toBe(0.5);
    });

    test('computeDelta returns inserts, updates, and removals', () => {
      const prev = [item(1, '2020-01-02'), item(2, '2020-01-01')];
      const curr = [item(1, '2020-01-02', { progress: 0.5 }), item(3, '2020-01-03')];

      const delta = computeDelta(prev, curr);

      expect(delta.removed).toEqual([2]);
      expect(delta.data.map((row) => row.id)).toEqual([1, 3]);
    });

    test('isSinglePageCatalog is true below mylist page limit', () => {
      expect(isSinglePageCatalog([item(1, '2020-01-01')])).toBe(true);
      expect(
        isSinglePageCatalog([
          ...Array.from({ length: 999 }, (_, i) => item(i + 1, '2020-01-01')),
          item(1000, '2020-01-01', { status: 'queued' }),
        ])
      ).toBe(true);
      expect(
        isSinglePageCatalog(Array.from({ length: 1000 }, (_, i) => item(i + 1, '2020-01-01')))
      ).toBe(false);
    });

    test('isMultiPageFromFullReconcile uses page count and regular row count', () => {
      expect(isMultiPageFromFullReconcile([item(1, '2020-01-01')], 1)).toBe(false);
      expect(
        isMultiPageFromFullReconcile(
          Array.from({ length: 1000 }, (_, i) => item(i + 1, '2020-01-01')),
          1
        )
      ).toBe(true);
      expect(isMultiPageFromFullReconcile([item(1, '2020-01-01')], 2)).toBe(true);
    });

    test('reconcileFailureBackoffMs grows exponentially with cap', () => {
      expect(reconcileFailureBackoffMs(0)).toBe(0);
      expect(reconcileFailureBackoffMs(1)).toBe(15_000);
      expect(reconcileFailureBackoffMs(2)).toBe(30_000);
      expect(reconcileFailureBackoffMs(10)).toBe(5 * 60 * 1000);
    });

    test('shallowFailureBackoffMs grows exponentially with cap', () => {
      expect(shallowFailureBackoffMs(0)).toBe(0);
      expect(shallowFailureBackoffMs(1)).toBe(5_000);
      expect(shallowFailureBackoffMs(2)).toBe(10_000);
      expect(shallowFailureBackoffMs(10)).toBe(10_000);
    });
  });

  describe('handleListSyncRequest', () => {
    test('full initial sync caches more than 1000 items', async () => {
      const fullData = Array.from({ length: 1500 }, (_, index) =>
        item(index + 1, `2020-01-${String((index % 28) + 1).padStart(2, '0')}`)
      );
      fetchFullDownloadListMock.mockResolvedValueOnce({
        success: true,
        data: fullData,
        pageCount: 2,
      });

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev: null,
        bypassCache: false,
      });

      expect(result.status).toBe(200);
      expect(result.compressedBody).toBeTruthy();
      expect(result.headers['x-sync-mode']).toBe('full');
      expect(getDownloadListSyncCacheEntry(API_KEY, TYPE)?.data).toHaveLength(1500);
    });

    test('rev === head returns 304 without TorBox calls', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev,
        bypassCache: false,
      });

      expect(result.status).toBe(304);
      expect(result.compressedBody).toBeUndefined();
      expect(result.headers['x-list-rev']).toBe(String(rev));
      expect(fetchShallowDownloadListMock).not.toHaveBeenCalled();
      expect(fetchFullDownloadListMock).not.toHaveBeenCalled();
    });

    test('matching rev blocks on shallow refresh when freshness expired', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);
      setDownloadListSyncCacheMetaForTests(API_KEY, TYPE, { lastShallowPollAt: 0 });

      fetchShallowDownloadListMock.mockResolvedValue(shallowResult([item(1, '2020-01-02')]));

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev,
        bypassCache: false,
      });

      expect(result.status).toBe(304);
      expect(fetchFullDownloadListMock).not.toHaveBeenCalled();
      expect(fetchShallowDownloadListMock).toHaveBeenCalledTimes(1);
    });

    test('stale poll returns delta in same response when shallow finds a new item', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);
      setDownloadListSyncCacheMetaForTests(API_KEY, TYPE, { lastShallowPollAt: 0 });

      fetchShallowDownloadListMock.mockResolvedValueOnce(
        shallowResult([item(2, '2020-01-03'), item(1, '2020-01-02')])
      );

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev,
        bypassCache: false,
      });

      expect(result.status).toBe(200);
      expect(result.headers['x-sync-mode']).toBe('delta');
      const body = parseCompressedBody(result.compressedBody);
      expect(body.delta).toBe(true);
      expect(body.data.map((row) => row.id)).toEqual([2]);
      expect(fetchShallowDownloadListMock).toHaveBeenCalledTimes(1);
    });

    test('stale rev without prior snapshot serves full cached body', async () => {
      setDownloadListSyncCacheForTests(API_KEY, TYPE, [
        item(1, '2020-01-02'),
        item(2, '2020-01-01'),
      ]);
      const entry = getDownloadListSyncCacheEntry(API_KEY, TYPE);

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev: entry.rev - 1,
        bypassCache: false,
      });

      expect(result.status).toBe(200);
      expect(result.headers['x-sync-mode']).toBe('stale-full');
      expect(result.headers['x-list-rev']).toBe(String(entry.rev));
      expect(fetchFullDownloadListMock).not.toHaveBeenCalled();
      expect(fetchShallowDownloadListMock).not.toHaveBeenCalled();
    });

    test('stale rev one behind returns delta for new item', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);

      fetchShallowDownloadListMock.mockResolvedValueOnce(
        shallowResult([item(2, '2020-01-03'), item(1, '2020-01-02')])
      );
      await runShallowRefresh(API_KEY, TYPE, { blocking: true });

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev,
        bypassCache: false,
      });

      expect(result.status).toBe(200);
      expect(result.headers['x-sync-mode']).toBe('delta');
      expect(result.headers['x-sync-delta-count']).toBe('1');
      const body = parseCompressedBody(result.compressedBody);
      expect(body.delta).toBe(true);
      expect(body.data.map((row) => row.id)).toEqual([2]);
      expect(body.removed).toEqual([]);
      expect(fetchFullDownloadListMock).not.toHaveBeenCalled();
    });

    test('stale rev multiple behind returns accumulated delta', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);

      fetchShallowDownloadListMock.mockResolvedValueOnce(
        shallowResult([item(1, '2020-01-02', { progress: 0.1 })])
      );
      await runShallowRefresh(API_KEY, TYPE, { blocking: true });

      setDownloadListSyncCacheMetaForTests(API_KEY, TYPE, { lastShallowPollAt: 0 });
      fetchShallowDownloadListMock.mockResolvedValueOnce(
        shallowResult([item(2, '2020-01-03'), item(1, '2020-01-02', { progress: 0.2 })])
      );
      await runShallowRefresh(API_KEY, TYPE, { blocking: true });

      const bumped = getDownloadListSyncCacheEntry(API_KEY, TYPE);
      expect(bumped.rev).toBe(rev + 2);

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev,
        bypassCache: false,
      });

      expect(result.status).toBe(200);
      expect(result.headers['x-sync-mode']).toBe('delta');
      const body = parseCompressedBody(result.compressedBody);
      expect(body.delta).toBe(true);
      expect(body.data.map((row) => row.id).sort((a, b) => a - b)).toEqual([1, 2]);
      expect(body.removed).toEqual([]);
    });

    test('stale rev with no catalog diff returns 304 and advances x-list-rev', async () => {
      const catalog = [item(1, '2020-01-02')];
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, catalog);
      setDownloadListSyncCacheForTests(API_KEY, TYPE, catalog);

      const entry = getDownloadListSyncCacheEntry(API_KEY, TYPE);
      expect(entry.rev).toBe(rev + 1);

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev,
        bypassCache: false,
      });

      expect(result.status).toBe(304);
      expect(result.headers['x-sync-mode']).toBe('unchanged');
      expect(result.headers['x-list-rev']).toBe(String(entry.rev));
      expect(result.compressedBody).toBeUndefined();
    });

    test('full reconcile with unchanged catalog does not bump rev', async () => {
      const catalog = [item(1, '2020-01-02'), item(2, '2020-01-01')];
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, catalog);

      fetchFullDownloadListMock.mockResolvedValueOnce({
        success: true,
        data: catalog,
        pageCount: 1,
      });

      await runFullReconciliation(API_KEY, TYPE, { blocking: true });

      const entry = getDownloadListSyncCacheEntry(API_KEY, TYPE);
      expect(entry.rev).toBe(rev);
    });

    test('multi-tab simulation: stale rev does not trigger full reconcile', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);

      fetchShallowDownloadListMock.mockResolvedValueOnce(
        shallowResult([item(1, '2020-01-02', { progress: 0.5 })])
      );
      await runShallowRefresh(API_KEY, TYPE, { blocking: true });

      const bumped = getDownloadListSyncCacheEntry(API_KEY, TYPE);
      expect(bumped.rev).toBeGreaterThan(rev);

      fetchFullDownloadListMock.mockClear();
      fetchShallowDownloadListMock.mockClear();

      const peer = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev,
        bypassCache: false,
      });

      expect(peer.status).toBe(200);
      expect(peer.headers['x-sync-mode']).toBe('delta');
      expect(peer.headers['x-list-rev']).toBe(String(bumped.rev));
      const body = parseCompressedBody(peer.compressedBody);
      expect(body.delta).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(fetchFullDownloadListMock).not.toHaveBeenCalled();
    });

    test('two stale reads coalesce one shallow refresh', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);
      setDownloadListSyncCacheMetaForTests(API_KEY, TYPE, { lastShallowPollAt: 0 });

      fetchShallowDownloadListMock.mockResolvedValue(
        shallowResult([item(1, '2020-01-02', { progress: 0.25 })])
      );

      const first = handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev: rev - 1,
        bypassCache: false,
      });
      const second = handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev: rev - 1,
        bypassCache: false,
      });

      await Promise.all([first, second]);
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(fetchShallowDownloadListMock).toHaveBeenCalledTimes(1);
    });

    test('bypassCache triggers blocking shallow refresh', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);

      fetchShallowDownloadListMock.mockResolvedValueOnce(
        shallowResult([item(1, '2020-01-02', { progress: 0.9 })])
      );

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev,
        bypassCache: true,
      });

      expect(result.status).toBe(200);
      expect(result.headers['x-sync-mode']).toBe('delta');
      expect(fetchShallowDownloadListMock).toHaveBeenCalledTimes(1);
      expect(
        getDownloadListSyncCacheEntry(API_KEY, TYPE)?.data.find((row) => row.id === 1).progress
      ).toBe(0.9);
    });

    test('bypassCache with matching rev returns 304 when TorBox has no changes', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);

      fetchShallowDownloadListMock.mockResolvedValueOnce(shallowResult([item(1, '2020-01-02')]));

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev,
        bypassCache: true,
      });

      expect(result.status).toBe(304);
      expect(result.headers['x-sync-mode']).toBe('unchanged');
      expect(fetchShallowDownloadListMock).toHaveBeenCalledTimes(1);
    });

    test('shallow refresh updates single-page catalog and bumps rev', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [
        item(1, '2020-01-02'),
        item(2, '2020-01-01'),
      ]);

      fetchShallowDownloadListMock.mockResolvedValueOnce(
        shallowResult([item(1, '2020-01-02', { progress: 0.5 })])
      );

      await runShallowRefresh(API_KEY, TYPE, { blocking: true });

      const cached = getDownloadListSyncCacheEntry(API_KEY, TYPE);
      expect(cached.rev).toBeGreaterThan(rev);
      expect(cached.data.map((row) => row.id)).toEqual([1]);
    });

    test('shallow patch never removes tail ids missing from page 0', async () => {
      const authoritative = [
        ...Array.from({ length: 1000 }, (_, index) => item(index + 1, '2020-01-02')),
        item(1500, '2020-01-01'),
      ];
      setDownloadListSyncCacheForTests(API_KEY, TYPE, authoritative, { isMultiPage: true });

      fetchShallowDownloadListMock.mockResolvedValueOnce(
        shallowResult(authoritative.slice(0, 1000), { regularPageLength: 1000 })
      );

      await runShallowRefresh(API_KEY, TYPE, { blocking: true });

      expect(getDownloadListSyncCacheEntry(API_KEY, TYPE)?.data).toHaveLength(1001);
      expect(
        getDownloadListSyncCacheEntry(API_KEY, TYPE)?.data.some((row) => row.id === 1500)
      ).toBe(true);
    });

    test('full reconciliation detects tail deletion', async () => {
      setDownloadListSyncCacheForTests(API_KEY, TYPE, [
        item(1, '2020-01-02'),
        item(1500, '2020-01-01'),
      ]);

      fetchFullDownloadListMock.mockResolvedValueOnce({
        success: true,
        data: [item(1, '2020-01-02')],
        pageCount: 1,
      });

      await runFullReconciliation(API_KEY, TYPE, { blocking: true });

      expect(getDownloadListSyncCacheEntry(API_KEY, TYPE)?.data).toHaveLength(1);
      expect(
        getDownloadListSyncCacheEntry(API_KEY, TYPE)?.data.some((row) => row.id === 1500)
      ).toBe(false);
    });

    test('failed full reconciliation preserves previous cache', async () => {
      setDownloadListSyncCacheForTests(API_KEY, TYPE, [
        item(1, '2020-01-02'),
        item(2, '2020-01-01'),
      ]);
      const before = getDownloadListSyncCacheEntry(API_KEY, TYPE);

      fetchFullDownloadListMock.mockImplementation(async () => {
        throw new Error('TorBox unavailable');
      });

      await expect(runFullReconciliation(API_KEY, TYPE, { blocking: true })).rejects.toThrow();

      const after = getDownloadListSyncCacheEntry(API_KEY, TYPE);
      expect(after.rev).toBe(before.rev);
      expect(after.reconcileState).toBe('error');
      expect(after.data).toHaveLength(2);
    });

    test('coalesces concurrent full sync requests', async () => {
      let resolveFetch;
      const pending = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      fetchFullDownloadListMock.mockImplementation(() => pending);

      const first = runFullReconciliation(API_KEY, TYPE, { blocking: true });
      const second = runFullReconciliation(API_KEY, TYPE, { blocking: true });

      resolveFetch({
        success: true,
        data: [item(1, '2020-01-02')],
        pageCount: 1,
      });

      const [a, b] = await Promise.all([first, second]);
      expect(a.data).toHaveLength(1);
      expect(b.data).toHaveLength(1);
      expect(fetchFullDownloadListMock).toHaveBeenCalledTimes(1);
    });

    test('patchCacheRemoveIds removes trusted ids and bumps rev', async () => {
      const rev = setDownloadListSyncCacheForTests(API_KEY, TYPE, [
        item(1, '2020-01-02'),
        item(2, '2020-01-01'),
      ]);
      await patchCacheRemoveIds(API_KEY, TYPE, [2]);

      const entry = getDownloadListSyncCacheEntry(API_KEY, TYPE);
      expect(entry.data.map((row) => row.id)).toEqual([1]);
      expect(entry.rev).toBeGreaterThan(rev);
    });

    test('shallow refresh during in-flight reconcile does not stomp reconcile result', async () => {
      const authoritative = [
        ...Array.from({ length: 1000 }, (_, index) => item(index + 1, '2020-01-02')),
        item(1500, '2020-01-01'),
      ];
      setDownloadListSyncCacheForTests(API_KEY, TYPE, authoritative, { isMultiPage: true });

      let resolveReconcile;
      const reconcilePending = new Promise((resolve) => {
        resolveReconcile = resolve;
      });
      fetchFullDownloadListMock.mockImplementation(() => reconcilePending);

      const reconcilePromise = runFullReconciliation(API_KEY, TYPE, { blocking: false });

      fetchShallowDownloadListMock.mockResolvedValueOnce(
        shallowResult(
          authoritative
            .slice(0, 1000)
            .map((row) => (row.id === 1 ? item(1, '2020-01-02', { progress: 0.5 }) : row)),
          { regularPageLength: 1000 }
        )
      );

      const shallowPromise = runShallowRefresh(API_KEY, TYPE, { blocking: true });

      resolveReconcile({
        success: true,
        data: [item(1, '2020-01-02'), item(2, '2020-01-03'), item(1500, '2020-01-01')],
        pageCount: 2,
      });

      await reconcilePromise;
      await shallowPromise;

      const cached = getDownloadListSyncCacheEntry(API_KEY, TYPE);
      expect(cached.data.map((row) => row.id).sort((a, b) => a - b)).toEqual([1, 2, 1500]);
    });

    test('single-page shallow refresh does not schedule background full reconcile', async () => {
      setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);

      fetchShallowDownloadListMock.mockResolvedValueOnce(shallowResult([item(1, '2020-01-02')]));

      await runShallowRefresh(API_KEY, TYPE, { blocking: true });

      scheduleBackgroundReconcileIfDue(API_KEY, TYPE);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(fetchFullDownloadListMock).not.toHaveBeenCalled();
    });

    test('boundary crossing preserves tail and marks catalog multi-page', async () => {
      const catalog = Array.from({ length: 1001 }, (_, index) =>
        item(
          index + 1,
          index === 0 ? '2020-01-01' : `2020-01-${String((index % 28) + 2).padStart(2, '0')}`
        )
      );
      setDownloadListSyncCacheForTests(API_KEY, TYPE, catalog, { isMultiPage: false });

      const pageZero = catalog.filter((row) => row.id !== 1);
      fetchShallowDownloadListMock.mockResolvedValueOnce(
        shallowResult(pageZero, { regularPageLength: 1000 })
      );

      await runShallowRefresh(API_KEY, TYPE, { blocking: true });

      const cached = getDownloadListSyncCacheEntry(API_KEY, TYPE);
      expect(cached.isMultiPage).toBe(true);
      expect(cached.data.some((row) => row.id === 1)).toBe(true);
      expect(cached.data).toHaveLength(1001);
    });

    test('failed background reconcile respects failure backoff', async () => {
      const authoritative = [
        ...Array.from({ length: 1000 }, (_, index) => item(index + 1, '2020-01-02')),
        item(1500, '2020-01-01'),
      ];
      setDownloadListSyncCacheForTests(API_KEY, TYPE, authoritative, { isMultiPage: true });
      setDownloadListSyncCacheMetaForTests(API_KEY, TYPE, {
        lastFullReconcileAt: 0,
        lastReconcileAttemptAt: Date.now(),
        reconcileFailureCount: 2,
      });

      fetchFullDownloadListMock.mockImplementation(async () => {
        throw new Error('TorBox unavailable');
      });

      scheduleBackgroundReconcileIfDue(API_KEY, TYPE);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fetchFullDownloadListMock).not.toHaveBeenCalled();
    });

    test('mutation reconcile timer skips when cache entry is gone', async () => {
      setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);
      await patchCacheRemoveIds(API_KEY, TYPE, [1]);

      clearDownloadListSyncCacheOnlyForTests();
      fetchFullDownloadListMock.mockClear();

      await flushMutationReconcileTimerForTests(API_KEY, TYPE);

      expect(fetchFullDownloadListMock).not.toHaveBeenCalled();
    });

    test('full reconcile sets reconciling state while in flight', async () => {
      setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);

      let resolveFetch;
      const pending = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      fetchFullDownloadListMock.mockImplementation(() => pending);

      const reconcilePromise = runFullReconciliation(API_KEY, TYPE, { blocking: true });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getDownloadListSyncCacheEntry(API_KEY, TYPE)?.reconcileState).toBe('reconciling');

      resolveFetch({
        success: true,
        data: [item(1, '2020-01-02'), item(2, '2020-01-01')],
        pageCount: 1,
      });
      await reconcilePromise;

      expect(getDownloadListSyncCacheEntry(API_KEY, TYPE)?.reconcileState).toBe('fresh');
    });

    test('ensureShallowRefreshIfStale is a no-op when cache is fresh', async () => {
      setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);

      const ran = await ensureShallowRefreshIfStale(API_KEY, TYPE);

      expect(ran).toBe(false);
      expect(fetchShallowDownloadListMock).not.toHaveBeenCalled();
    });

    test('cold cache does not publish empty placeholder during in-flight reconcile', async () => {
      let resolveFetch;
      const pending = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      fetchFullDownloadListMock.mockImplementation(() => pending);

      const first = handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev: null,
        bypassCache: false,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getDownloadListSyncCacheEntry(API_KEY, TYPE)).toBeNull();

      const second = handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev: null,
        bypassCache: false,
      });

      resolveFetch({
        success: true,
        data: [item(1, '2020-01-02')],
        pageCount: 1,
      });

      const [firstResult, secondResult] = await Promise.all([first, second]);
      expect(firstResult.status).toBe(200);
      expect(secondResult.status).toBe(200);
      expect(fetchFullDownloadListMock).toHaveBeenCalledTimes(1);
      expect(getDownloadListSyncCacheEntry(API_KEY, TYPE)?.data).toHaveLength(1);
    });

    test('cold cache failure throws instead of serving empty snapshot', async () => {
      fetchFullDownloadListMock.mockImplementation(async () => {
        throw new Error('TorBox unavailable');
      });

      await expect(
        handleListSyncRequest({
          apiKey: API_KEY,
          type: TYPE,
          rev: null,
          bypassCache: false,
        })
      ).rejects.toThrow();

      expect(getDownloadListSyncCacheEntry(API_KEY, TYPE)).toBeNull();
    });

    test('full reconcile skips publish when trusted mutation occurs during reconcile', async () => {
      setDownloadListSyncCacheForTests(API_KEY, TYPE, [
        item(1, '2020-01-02'),
        item(2, '2020-01-01'),
      ]);

      let resolveFetch;
      const pending = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      fetchFullDownloadListMock.mockImplementation(() => pending);

      const reconcilePromise = runFullReconciliation(API_KEY, TYPE, { blocking: false });

      await patchCacheRemoveIds(API_KEY, TYPE, [2]);

      resolveFetch({
        success: true,
        data: [item(1, '2020-01-02'), item(2, '2020-01-01')],
        pageCount: 1,
      });
      await reconcilePromise;

      const entry = getDownloadListSyncCacheEntry(API_KEY, TYPE);
      expect(entry.data.map((row) => row.id)).toEqual([1]);
    });

    test('bypass-cache on cold cache reports full sync mode', async () => {
      fetchFullDownloadListMock.mockResolvedValueOnce({
        success: true,
        data: [item(1, '2020-01-02')],
        pageCount: 1,
      });

      const result = await handleListSyncRequest({
        apiKey: API_KEY,
        type: TYPE,
        rev: null,
        bypassCache: true,
      });

      expect(result.status).toBe(200);
      expect(result.headers['x-sync-mode']).toBe('full');
      expect(fetchFullDownloadListMock).toHaveBeenCalledTimes(1);
      expect(fetchShallowDownloadListMock).not.toHaveBeenCalled();
    });

    test('failed blocking shallow refresh applies backoff on next stale read', async () => {
      setDownloadListSyncCacheForTests(API_KEY, TYPE, [item(1, '2020-01-02')]);
      setDownloadListSyncCacheMetaForTests(API_KEY, TYPE, { lastShallowPollAt: 0 });

      fetchShallowDownloadListMock.mockRejectedValueOnce(new Error('TorBox unavailable'));

      await expect(ensureShallowRefreshIfStale(API_KEY, TYPE)).resolves.toBe(true);

      fetchShallowDownloadListMock.mockClear();
      const ranAgain = await ensureShallowRefreshIfStale(API_KEY, TYPE);

      expect(ranAgain).toBe(false);
      expect(fetchShallowDownloadListMock).not.toHaveBeenCalled();
    });
  });
});

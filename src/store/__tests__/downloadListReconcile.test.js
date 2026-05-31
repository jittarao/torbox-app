import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';

const fetchDownloadTypeMock = mock(async () => []);
const resetPollTimerMock = mock(() => {});
const removeByIdsMock = mock(() => {});

mock.module('@/store/torboxDownloadsFetch', () => ({
  fetchDownloadType: (...args) => fetchDownloadTypeMock(...args),
}));

mock.module('@/store/pollTimerReset', () => ({
  resetPollTimer: () => resetPollTimerMock(),
}));

mock.module('@/store/torboxDownloadsStore', () => ({
  useTorboxDownloadsStore: {
    getState: () => ({ removeByIds: removeByIdsMock }),
  },
}));

import {
  cancelScheduledReconcile,
  registerDownloadsSyncContext,
  removeQueuedAfterForceStart,
  removeQueuedAfterForceStartBulk,
  scheduleDelayedDownloadsReconcile,
  unregisterDownloadsSyncContext,
} from '@/store/downloadListReconcile';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('downloadListReconcile', () => {
  beforeEach(() => {
    cancelScheduledReconcile();
    fetchDownloadTypeMock.mockClear();
    resetPollTimerMock.mockClear();
    removeByIdsMock.mockClear();
    registerDownloadsSyncContext({ apiKey: 'test-key', viewType: 'torrents' });
  });

  afterEach(() => {
    cancelScheduledReconcile();
    unregisterDownloadsSyncContext();
  });

  test('coalesces rapid calls into one fetch after debounce + initial delay', async () => {
    scheduleDelayedDownloadsReconcile(['torrents'], {
      debounceMs: 30,
      initialDelayMs: 40,
    });
    scheduleDelayedDownloadsReconcile(['torrents'], { debounceMs: 30, initialDelayMs: 40 });
    scheduleDelayedDownloadsReconcile(['torrents'], { debounceMs: 30, initialDelayMs: 40 });
    scheduleDelayedDownloadsReconcile(['torrents'], { debounceMs: 30, initialDelayMs: 40 });
    scheduleDelayedDownloadsReconcile(['torrents'], { debounceMs: 30, initialDelayMs: 40 });

    expect(fetchDownloadTypeMock).toHaveBeenCalledTimes(0);
    expect(resetPollTimerMock).toHaveBeenCalledTimes(5);

    await sleep(100);

    expect(fetchDownloadTypeMock).toHaveBeenCalledTimes(1);
    expect(fetchDownloadTypeMock).toHaveBeenCalledWith('test-key', 'torrents', 'torrents', {
      bypassCache: true,
      skipLoading: true,
      forMutation: true,
    });
  });

  test('merges asset types from coalesced calls', async () => {
    scheduleDelayedDownloadsReconcile(['torrents'], { debounceMs: 20, initialDelayMs: 20 });
    scheduleDelayedDownloadsReconcile(['usenet'], { debounceMs: 20, initialDelayMs: 20 });

    await sleep(60);

    expect(fetchDownloadTypeMock).toHaveBeenCalledTimes(2);
    expect(fetchDownloadTypeMock).toHaveBeenCalledWith(
      'test-key',
      'torrents',
      'torrents',
      expect.objectContaining({ forMutation: true })
    );
    expect(fetchDownloadTypeMock).toHaveBeenCalledWith(
      'test-key',
      'usenet',
      'torrents',
      expect.objectContaining({ forMutation: true })
    );
  });

  test('does not cancel in-flight initial delay when new types arrive during wait', async () => {
    scheduleDelayedDownloadsReconcile(['torrents'], { debounceMs: 20, initialDelayMs: 60 });
    await sleep(30);
    scheduleDelayedDownloadsReconcile(['usenet'], { debounceMs: 20, initialDelayMs: 60 });

    await sleep(80);

    expect(fetchDownloadTypeMock).toHaveBeenCalledTimes(2);
    expect(fetchDownloadTypeMock).toHaveBeenCalledWith(
      'test-key',
      'torrents',
      'torrents',
      expect.objectContaining({ forMutation: true })
    );
    expect(fetchDownloadTypeMock).toHaveBeenCalledWith(
      'test-key',
      'usenet',
      'torrents',
      expect.objectContaining({ forMutation: true })
    );
  });

  test('does not fetch when sync context is unregistered', async () => {
    unregisterDownloadsSyncContext();
    scheduleDelayedDownloadsReconcile(['torrents'], { debounceMs: 10, initialDelayMs: 10 });

    await sleep(40);

    expect(fetchDownloadTypeMock).toHaveBeenCalledTimes(0);
  });

  test('cancelScheduledReconcile prevents pending fetch', async () => {
    scheduleDelayedDownloadsReconcile(['torrents'], { debounceMs: 50, initialDelayMs: 50 });
    cancelScheduledReconcile();

    await sleep(120);

    expect(fetchDownloadTypeMock).toHaveBeenCalledTimes(0);
  });

  test('removeQueuedAfterForceStart removes ids and resets poll timer', () => {
    removeQueuedAfterForceStart('torrents', [10, 11]);

    expect(removeByIdsMock).toHaveBeenCalledTimes(1);
    expect(removeByIdsMock).toHaveBeenCalledWith('torrents', [10, 11]);
    expect(resetPollTimerMock).toHaveBeenCalled();
  });

  test('removeQueuedAfterForceStartBulk groups by asset type', async () => {
    removeQueuedAfterForceStartBulk({ torrents: [1], usenet: [2], webdl: [] });

    expect(removeByIdsMock).toHaveBeenCalledTimes(2);
    expect(removeByIdsMock).toHaveBeenCalledWith('torrents', [1]);
    expect(removeByIdsMock).toHaveBeenCalledWith('usenet', [2]);
  });
});

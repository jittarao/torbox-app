import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { processedQueueIdsRef } from '@/store/torboxDownloadsRefs';

const uploadOptions = { autoStart: true, autoStartLimit: 10 };

const controlQueuedItemMock = mock(async (apiKey, queuedId) => {
  if (apiKey === 'fail') {
    return { success: false, error: 'nope' };
  }
  return { success: true, data: { queued_id: queuedId } };
});

mock.module('@/utils/utility', () => ({
  getAutoStartOptions: () => uploadOptions,
}));

mock.module('@/utils/uploadActions', () => ({
  controlQueuedItem: (...args) => controlQueuedItemMock(...args),
}));

const removeByIdsMock = mock(() => {});

mock.module('@/store/torboxDownloadsStore', () => ({
  useTorboxDownloadsStore: {
    getState: () => ({ removeByIds: removeByIdsMock }),
  },
}));

import {
  fillAutoStartSlots,
  pruneProcessedQueueIds,
  coerceAutoStartLimit,
} from '../torrentAutoStart';

function queued(id) {
  return { id, status: 'queued', active: false };
}

describe('coerceAutoStartLimit', () => {
  test('parses valid limits and caps high values', () => {
    expect(coerceAutoStartLimit(10)).toBe(10);
    expect(coerceAutoStartLimit('7')).toBe(7);
    expect(coerceAutoStartLimit(9999)).toBe(999);
  });

  test('falls back when invalid', () => {
    expect(coerceAutoStartLimit(undefined)).toBe(3);
    expect(coerceAutoStartLimit(0)).toBe(3);
  });
});

describe('fillAutoStartSlots', () => {
  beforeEach(() => {
    processedQueueIdsRef.current = new Map();
    controlQueuedItemMock.mockClear();
    removeByIdsMock.mockClear();
    uploadOptions.autoStart = true;
    uploadOptions.autoStartLimit = 10;
  });

  test('starts multiple torrents to fill available slots', async () => {
    const items = [
      { id: 1, active: true },
      { id: 2, active: true },
      queued(10),
      queued(11),
      queued(12),
      queued(13),
    ];

    const result = await fillAutoStartSlots(items, 'key', { viewType: 'torrents' });

    expect(result.started).toBe(4);
    expect(result.slotsAvailable).toBe(8);
    expect(controlQueuedItemMock).toHaveBeenCalledTimes(4);
    expect(removeByIdsMock).toHaveBeenCalledTimes(1);
    expect(removeByIdsMock).toHaveBeenCalledWith('torrents', [10, 11, 12, 13]);
  });

  test('skips recently processed ids and tries the next queued item', async () => {
    processedQueueIdsRef.current.set(10, Date.now());

    const items = [queued(10), queued(11)];

    const result = await fillAutoStartSlots(items, 'key', { viewType: 'torrents' });

    expect(result.started).toBe(1);
    expect(controlQueuedItemMock).toHaveBeenCalledTimes(1);
    expect(controlQueuedItemMock).toHaveBeenCalledWith('key', 11, 'start', 'torrents');
  });

  test('does not block later items when the first queued id is processed', async () => {
    processedQueueIdsRef.current.set(10, Date.now());

    const items = [queued(10), queued(11), queued(12)];

    const result = await fillAutoStartSlots(items, 'key', { viewType: 'torrents' });

    expect(result.started).toBe(2);
    expect(controlQueuedItemMock).toHaveBeenCalledTimes(2);
  });

  test('removes processed marker when start fails so the next poll can retry', async () => {
    const items = [queued(99)];

    await fillAutoStartSlots(items, 'fail', { viewType: 'torrents' });

    expect(processedQueueIdsRef.current.has(99)).toBe(false);
    expect(removeByIdsMock).not.toHaveBeenCalled();
  });
});

describe('pruneProcessedQueueIds', () => {
  test('drops ids that are no longer queued', () => {
    processedQueueIdsRef.current.set(1, Date.now());
    processedQueueIdsRef.current.set(2, Date.now());

    pruneProcessedQueueIds([queued(2)]);

    expect(processedQueueIdsRef.current.has(1)).toBe(false);
    expect(processedQueueIdsRef.current.has(2)).toBe(true);
  });
});

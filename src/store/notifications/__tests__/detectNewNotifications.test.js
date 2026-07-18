import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { removeItem } from '@/utils/storage';
import {
  buildTorboxNativeNotificationPayloads,
  filterAlreadyOsNotified,
  findNewNotifications,
  loadOsNotifiedIds,
  persistOsNotifiedIds,
  TORBOX_NOTIFICATION_BATCH_LIMIT,
} from '@/store/notifications/detectNewNotifications';

const OS_NOTIFIED_STORAGE_KEY = 'osNotifiedNotifications:v1';
const storage = new Map();

beforeEach(() => {
  storage.clear();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
    removeItem: (key) => {
      storage.delete(key);
    },
  };
});

afterEach(() => {
  removeItem(OS_NOTIFIED_STORAGE_KEY);
});

describe('findNewNotifications', () => {
  test('returns items in next that were not in previous', () => {
    const previous = [
      { id: 1, title: 'A' },
      { id: 2, title: 'B' },
    ];
    const next = [
      { id: 1, title: 'A' },
      { id: 2, title: 'B' },
      { id: 3, title: 'C' },
    ];

    expect(findNewNotifications(previous, next)).toEqual([{ id: 3, title: 'C' }]);
  });

  test('returns empty array when next is empty', () => {
    expect(findNewNotifications([{ id: 1 }], [])).toEqual([]);
  });

  test('treats first fetch as all new relative to empty previous', () => {
    const next = [{ id: 1, title: 'First' }];
    expect(findNewNotifications([], next)).toEqual(next);
  });
});

describe('os notified persistence', () => {
  test('filters already os-notified ids', () => {
    const osNotified = new Set([1, 2]);
    const items = [
      { id: 1, title: 'Seen' },
      { id: 3, title: 'New' },
    ];

    expect(filterAlreadyOsNotified(items, osNotified)).toEqual([{ id: 3, title: 'New' }]);
  });

  test('persists and reloads os-notified ids', () => {
    persistOsNotifiedIds([10, 20]);
    expect(loadOsNotifiedIds()).toEqual(new Set([10, 20]));

    persistOsNotifiedIds([30]);
    expect(loadOsNotifiedIds()).toEqual(new Set([10, 20, 30]));
  });
});

describe('buildTorboxNativeNotificationPayloads', () => {
  test('returns one payload per item when within batch limit', () => {
    const items = [
      { id: 1, title: 'One', message: 'First' },
      { id: 2, title: 'Two', message: 'Second' },
    ];

    expect(buildTorboxNativeNotificationPayloads(items)).toEqual([
      { id: 1, title: 'One', body: 'First' },
      { id: 2, title: 'Two', body: 'Second' },
    ]);
  });

  test('adds summary payload when more than batch limit', () => {
    const items = Array.from({ length: TORBOX_NOTIFICATION_BATCH_LIMIT + 2 }, (_, index) => ({
      id: index + 1,
      title: `Title ${index + 1}`,
      message: `Message ${index + 1}`,
    }));

    const payloads = buildTorboxNativeNotificationPayloads(items);
    expect(payloads).toHaveLength(TORBOX_NOTIFICATION_BATCH_LIMIT + 1);
    expect(payloads[TORBOX_NOTIFICATION_BATCH_LIMIT]).toEqual({
      id: null,
      title: 'TorBox',
      body: '2 more TorBox notifications',
    });
  });
});

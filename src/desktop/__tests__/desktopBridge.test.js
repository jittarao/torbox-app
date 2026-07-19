import { describe, expect, test, mock, afterEach, beforeEach } from 'bun:test';
import { hasFeature } from '@/desktop/capabilities';
import { restoreDomGlobals } from '../../../test-setup-dom.js';

describe('hasFeature', () => {
  test('returns true when feature exists', () => {
    expect(
      hasFeature(
        {
          protocolVersion: 1,
          features: { secureCredentials: { version: 1, canStoreApiKey: true } },
        },
        'secureCredentials'
      )
    ).toBe(true);
  });

  test('returns false when capabilities are null', () => {
    expect(hasFeature(null, 'secureCredentials')).toBe(false);
  });

  test('returns false for null updater capability', () => {
    expect(
      hasFeature(
        {
          protocolVersion: 1,
          features: { updater: null },
        },
        'updater'
      )
    ).toBe(false);
  });
});

describe('desktopBridge browser fallback', () => {
  afterEach(() => {
    mock.restore();
    restoreDomGlobals();
  });

  beforeEach(() => {
    globalThis.window = {};
  });

  test('isAvailable returns false outside Tauri', async () => {
    const { isAvailable, resetAvailabilityCache } = await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(isAvailable()).resolves.toBe(false);
  });

  test('hello returns null outside Tauri', async () => {
    const { hello } = await import('@/desktop/desktopBridge');
    await expect(hello()).resolves.toBeNull();
  });

  test('getCredentialStatus returns null outside Tauri', async () => {
    const { getCredentialStatus, resetAvailabilityCache } = await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(getCredentialStatus()).resolves.toBeNull();
  });

  test('pickFolder returns null outside Tauri', async () => {
    const { pickFolder, resetAvailabilityCache } = await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(pickFolder()).resolves.toBeNull();
  });

  test('getFolderWatcherConfig returns null outside Tauri', async () => {
    const { getFolderWatcherConfig, resetAvailabilityCache } =
      await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(getFolderWatcherConfig()).resolves.toBeNull();
  });

  test('startFolderWatcher returns false outside Tauri', async () => {
    const { startFolderWatcher, resetAvailabilityCache } = await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(startFolderWatcher()).resolves.toBe(false);
  });

  test('getLaunchAtLogin returns null outside Tauri', async () => {
    const { getLaunchAtLogin, resetAvailabilityCache } = await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(getLaunchAtLogin()).resolves.toBeNull();
  });

  test('getTraySettings returns null outside Tauri', async () => {
    const { getTraySettings, resetAvailabilityCache } = await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(getTraySettings()).resolves.toBeNull();
  });

  test('getNotificationSettings returns null outside Tauri', async () => {
    const { getNotificationSettings, resetAvailabilityCache } =
      await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(getNotificationSettings()).resolves.toBeNull();
  });

  test('checkForUpdate returns null outside Tauri', async () => {
    const { checkForUpdate, resetAvailabilityCache } = await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(checkForUpdate()).resolves.toBeNull();
  });
});

describe('folderWatcher capabilities', () => {
  test('folderWatcherSupportsMultiRule requires version 2', async () => {
    const { folderWatcherSupportsMultiRule } = await import('@/desktop/capabilities');
    expect(
      folderWatcherSupportsMultiRule({
        protocolVersion: 1,
        features: { folderWatcher: { version: 1 } },
      })
    ).toBe(false);
    expect(
      folderWatcherSupportsMultiRule({
        protocolVersion: 1,
        features: { folderWatcher: { version: 2, maxRules: 10 } },
      })
    ).toBe(true);
  });
});

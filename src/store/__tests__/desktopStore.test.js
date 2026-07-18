import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { restoreDomGlobals } from '../../../test-setup-dom.js';

function mockDesktopBridge(overrides = {}) {
  return {
    isAvailable: async () => false,
    hello: async () => null,
    getCredentialStatus: async () => null,
    getFolderWatcherConfig: async () => null,
    getFolderWatcherStatus: async () => null,
    getLaunchAtLogin: async () => null,
    setLaunchAtLogin: async () => null,
    getTraySettings: async () => null,
    setTraySettings: async () => null,
    getNotificationSettings: async () => null,
    setNotificationSettings: async () => null,
    showTestNotification: async () => false,
    checkForUpdate: async () => null,
    installUpdate: async () => false,
    resetAvailabilityCache: () => {},
    ...overrides,
  };
}

function mockDesktopEvents() {
  return {
    onCapabilitiesChanged: async () => null,
    onWatcherStatusChanged: async () => null,
    onUploadSucceeded: async () => null,
    onUploadFailed: async () => null,
    onTrayOpenSettings: async () => null,
    onUpdateAvailable: async () => null,
  };
}

describe('desktopStore', () => {
  afterEach(() => {
    mock.restore();
    restoreDomGlobals();
  });

  beforeEach(() => {
    globalThis.window = {};
  });

  test('initialize marks unavailable outside Tauri without error', async () => {
    mock.module('@/desktop/desktopBridge', () => mockDesktopBridge());
    mock.module('@/desktop/events', () => mockDesktopEvents());

    const { useDesktopStore } = await import('@/store/desktopStore');
    useDesktopStore.setState({
      initialized: false,
      available: false,
      initError: null,
    });

    await useDesktopStore.getState().initialize();

    expect(useDesktopStore.getState().initialized).toBe(true);
    expect(useDesktopStore.getState().available).toBe(false);
    expect(useDesktopStore.getState().initError).toBeNull();
  });

  test('initialize captures bridge errors', async () => {
    mock.module('@/desktop/desktopBridge', () =>
      mockDesktopBridge({
        isAvailable: async () => true,
        hello: async () => {
          throw new Error('invoke failed');
        },
      })
    );
    mock.module('@/desktop/events', () => mockDesktopEvents());

    const { useDesktopStore } = await import('@/store/desktopStore');
    useDesktopStore.setState({
      initialized: false,
      available: false,
      initError: null,
    });

    await useDesktopStore.getState().initialize();

    expect(useDesktopStore.getState().initialized).toBe(true);
    expect(useDesktopStore.getState().available).toBe(false);
    expect(useDesktopStore.getState().initError).toBe('invoke failed');
  });

  test('setLaunchAtLoginEnabled rolls back on failure', async () => {
    const previous = { enabled: false, osEnabled: true };
    mock.module('@/desktop/desktopBridge', () =>
      mockDesktopBridge({
        setLaunchAtLogin: async () => {
          throw new Error('autostart denied');
        },
      })
    );
    mock.module('@/desktop/events', () => mockDesktopEvents());

    const { useDesktopStore } = await import('@/store/desktopStore');
    useDesktopStore.setState({
      launchAtLogin: previous,
    });

    await expect(useDesktopStore.getState().setLaunchAtLoginEnabled(true)).rejects.toThrow(
      'autostart denied'
    );
    expect(useDesktopStore.getState().launchAtLogin).toEqual(previous);
  });
});

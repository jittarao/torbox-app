import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { restoreDomGlobals } from '../../../test-setup-dom.js';

function mockDesktopBridge(overrides = {}) {
  return {
    isAvailable: async () => false,
    hello: async () => null,
    getCredentialStatus: async () => null,
    getFolderWatcherConfig: async () => null,
    setFolderWatcherConfig: async () => true,
    startFolderWatcher: async () => true,
    stopFolderWatcher: async () => true,
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
    setInstanceUrl: async () => null,
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

  test('setInstanceUrl updates hello without refreshHello', async () => {
    const hello = {
      protocolVersion: 1,
      appVersion: '0.1.0',
      buildChannel: 'stable',
      platform: 'windows',
      capabilities: {
        protocolVersion: 1,
        features: {
          instanceUrl: { version: 1, canCustomize: true },
        },
      },
      minimumSupportedWebBridgeVersion: 1,
      instanceUrl: 'https://tbm.tools',
    };
    const refreshHello = mock(async () => {
      throw new Error('Origin does not match configured instance URL');
    });

    mock.module('@/desktop/desktopBridge', () =>
      mockDesktopBridge({
        isAvailable: async () => true,
        setInstanceUrl: async () => 'https://self-hosted.example.com',
        hello: refreshHello,
      })
    );
    mock.module('@/desktop/events', () => mockDesktopEvents());

    const { useDesktopStore } = await import('@/store/desktopStore');
    useDesktopStore.setState({ hello });

    await expect(
      useDesktopStore.getState().setInstanceUrl('https://self-hosted.example.com')
    ).resolves.toBe('https://self-hosted.example.com');
    expect(refreshHello).not.toHaveBeenCalled();
    expect(useDesktopStore.getState().hello?.instanceUrl).toBe('https://self-hosted.example.com');
  });

  test('refreshWatcherStatus stores per-rule status breakdown', async () => {
    const watcherStatus = {
      running: true,
      queueDepth: 2,
      lastError: null,
      uploadsToday: 3,
      rules: [
        {
          ruleId: 'rule-a',
          watchPath: '/tmp/watch-a',
          enabled: true,
          active: true,
          queueDepth: 1,
          uploadsToday: 2,
          lastError: null,
        },
        {
          ruleId: 'rule-b',
          watchPath: '/tmp/watch-b',
          enabled: true,
          active: false,
          queueDepth: 1,
          uploadsToday: 1,
          lastError: 'upload failed',
        },
      ],
    };

    mock.module('@/desktop/desktopBridge', () =>
      mockDesktopBridge({
        isAvailable: async () => true,
        hello: async () => ({
          protocolVersion: 1,
          appVersion: '0.1.0',
          buildChannel: 'stable',
          platform: 'macos',
          capabilities: {
            protocolVersion: 1,
            features: { folderWatcher: { version: 2, maxRules: 10 } },
          },
          minimumSupportedWebBridgeVersion: 1,
          instanceUrl: 'https://tbm.tools',
        }),
        getFolderWatcherStatus: async () => watcherStatus,
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

    expect(useDesktopStore.getState().watcherStatus?.rules).toHaveLength(2);
    expect(useDesktopStore.getState().watcherStatus?.rules[0].ruleId).toBe('rule-a');
    expect(useDesktopStore.getState().watcherStatus?.rules[1].lastError).toBe('upload failed');
  });

  test('saveWatcherConfig refreshes config after start failure rollback', async () => {
    const rolledBackConfig = {
      rules: [{ id: 'rule-a', enabled: false, watchPath: '/tmp/watch-a' }],
    };
    let configLoads = 0;

    mock.module('@/desktop/desktopBridge', () =>
      mockDesktopBridge({
        isAvailable: async () => true,
        setFolderWatcherConfig: async () => {
          throw new Error('Failed to watch folder');
        },
        getFolderWatcherConfig: async () => {
          configLoads += 1;
          return rolledBackConfig;
        },
        getFolderWatcherStatus: async () => null,
      })
    );
    mock.module('@/desktop/events', () => mockDesktopEvents());

    const { useDesktopStore } = await import('@/store/desktopStore');
    useDesktopStore.setState({
      watcherConfig: {
        rules: [{ id: 'rule-a', enabled: true, watchPath: '/tmp/watch-a' }],
      },
    });

    await expect(
      useDesktopStore.getState().saveWatcherConfig({
        rules: [{ id: 'rule-a', enabled: true, watchPath: '/tmp/watch-a' }],
      })
    ).rejects.toThrow('Failed to watch folder');

    expect(configLoads).toBeGreaterThan(0);
    expect(useDesktopStore.getState().watcherConfig).toEqual(rolledBackConfig);
  });
});

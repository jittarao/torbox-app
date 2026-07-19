import { create } from 'zustand';
import * as desktopBridge from '@/desktop/desktopBridge';
import * as desktopEvents from '@/desktop/events';
import type {
  CredentialStatus,
  FolderWatcherConfig,
  HelloResponse,
  LaunchAtLoginStatus,
  NotificationSettings,
  TraySettings,
  UpdateInfo,
  WatcherStatus,
} from '@/desktop/capabilities';

type DesktopStoreState = {
  initialized: boolean;
  available: boolean;
  initError: string | null;
  hello: HelloResponse | null;
  credentialStatus: CredentialStatus | null;
  watcherConfig: FolderWatcherConfig | null;
  watcherStatus: WatcherStatus | null;
  launchAtLogin: LaunchAtLoginStatus | null;
  traySettings: TraySettings | null;
  notificationSettings: NotificationSettings | null;
  pendingUpdate: UpdateInfo | null;
  initialize: () => Promise<void>;
  retryInitialize: () => Promise<void>;
  refreshHello: () => Promise<void>;
  refreshCredentialStatus: () => Promise<void>;
  refreshWatcherConfig: () => Promise<void>;
  refreshWatcherStatus: () => Promise<void>;
  refreshLaunchAtLogin: () => Promise<void>;
  refreshTraySettings: () => Promise<void>;
  refreshNotificationSettings: () => Promise<void>;
  setInstanceUrl: (url: string) => Promise<string | null>;
  syncApiKey: (apiKey: string) => Promise<boolean>;
  clearCredential: () => Promise<boolean>;
  pickFolder: () => Promise<string | null>;
  pickMoveDestinationFolder: () => Promise<string | null>;
  saveWatcherConfig: (config: FolderWatcherConfig) => Promise<boolean>;
  startWatcher: (scanExisting?: boolean) => Promise<boolean>;
  stopWatcher: () => Promise<boolean>;
  setLaunchAtLoginEnabled: (enabled: boolean) => Promise<LaunchAtLoginStatus | null>;
  saveTraySettings: (settings: TraySettings) => Promise<TraySettings | null>;
  saveNotificationSettings: (
    settings: NotificationSettings
  ) => Promise<NotificationSettings | null>;
  sendTestNotification: () => Promise<boolean>;
  checkForUpdate: () => Promise<UpdateInfo | null>;
  installUpdate: () => Promise<boolean>;
};

let eventCleanup: (() => void) | null = null;

async function subscribeDesktopEvents(
  set: (partial: Partial<DesktopStoreState>) => void,
  get: () => DesktopStoreState
): Promise<void> {
  if (eventCleanup) {
    eventCleanup();
    eventCleanup = null;
  }

  const unlisteners = await Promise.all([
    desktopEvents.onCapabilitiesChanged(async () => {
      await get().refreshHello();
      await Promise.all([
        get().refreshWatcherConfig(),
        get().refreshWatcherStatus(),
        get().refreshLaunchAtLogin(),
        get().refreshTraySettings(),
        get().refreshNotificationSettings(),
      ]);
    }),
    desktopEvents.onWatcherStatusChanged((status) => {
      set({ watcherStatus: status });
    }),
    desktopEvents.onUploadSucceeded(() => {
      desktopBridge.getFolderWatcherStatus().then((status) => {
        if (status) {
          set({ watcherStatus: status });
        }
      });
    }),
    desktopEvents.onUploadFailed(() => {
      desktopBridge.getFolderWatcherStatus().then((status) => {
        if (status) {
          set({ watcherStatus: status });
        }
      });
    }),
    desktopEvents.onUpdateAvailable((info) => {
      set({ pendingUpdate: info });
    }),
  ]);

  eventCleanup = () => {
    unlisteners.forEach((unlisten) => {
      unlisten?.();
    });
  };
}

async function loadDesktopState(
  set: (partial: Partial<DesktopStoreState>) => void,
  get: () => DesktopStoreState
): Promise<void> {
  const [
    hello,
    credentialStatus,
    watcherConfig,
    watcherStatus,
    launchAtLogin,
    traySettings,
    notificationSettings,
  ] = await Promise.all([
    desktopBridge.hello(),
    desktopBridge.getCredentialStatus(),
    desktopBridge.getFolderWatcherConfig(),
    desktopBridge.getFolderWatcherStatus(),
    desktopBridge.getLaunchAtLogin(),
    desktopBridge.getTraySettings(),
    desktopBridge.getNotificationSettings(),
  ]);

  await subscribeDesktopEvents(set, get);

  set({
    initialized: true,
    available: true,
    initError: null,
    hello,
    credentialStatus,
    watcherConfig,
    watcherStatus,
    launchAtLogin,
    traySettings,
    notificationSettings,
    pendingUpdate: null,
  });
}

export const useDesktopStore = create<DesktopStoreState>((set, get) => ({
  initialized: false,
  available: false,
  initError: null,
  hello: null,
  credentialStatus: null,
  watcherConfig: null,
  watcherStatus: null,
  launchAtLogin: null,
  traySettings: null,
  notificationSettings: null,
  pendingUpdate: null,

  initialize: async () => {
    if (get().initialized) {
      return;
    }

    try {
      const available = await desktopBridge.isAvailable();
      if (!available) {
        set({
          initialized: true,
          available: false,
          initError: null,
          hello: null,
          credentialStatus: null,
          watcherConfig: null,
          watcherStatus: null,
          launchAtLogin: null,
          traySettings: null,
          notificationSettings: null,
          pendingUpdate: null,
        });
        return;
      }

      await loadDesktopState(set, get);
    } catch (error) {
      set({
        initialized: true,
        available: false,
        initError: error instanceof Error ? error.message : 'Desktop bridge initialization failed',
        hello: null,
        credentialStatus: null,
        watcherConfig: null,
        watcherStatus: null,
        launchAtLogin: null,
        traySettings: null,
        notificationSettings: null,
        pendingUpdate: null,
      });
    }
  },

  retryInitialize: async () => {
    desktopBridge.resetAvailabilityCache();
    set({
      initialized: false,
      available: false,
      initError: null,
      hello: null,
      credentialStatus: null,
      watcherConfig: null,
      watcherStatus: null,
      launchAtLogin: null,
      traySettings: null,
      notificationSettings: null,
      pendingUpdate: null,
    });
    await get().initialize();
  },

  refreshHello: async () => {
    if (!(await desktopBridge.isAvailable())) {
      set({ available: false, hello: null });
      return;
    }
    const hello = await desktopBridge.hello();
    set({ available: true, hello });
  },

  refreshCredentialStatus: async () => {
    if (!(await desktopBridge.isAvailable())) {
      set({ credentialStatus: null });
      return;
    }
    const credentialStatus = await desktopBridge.getCredentialStatus();
    set({ credentialStatus });
  },

  refreshWatcherConfig: async () => {
    const watcherConfig = await desktopBridge.getFolderWatcherConfig();
    set({ watcherConfig });
  },

  refreshWatcherStatus: async () => {
    const watcherStatus = await desktopBridge.getFolderWatcherStatus();
    set({ watcherStatus });
  },

  refreshLaunchAtLogin: async () => {
    const launchAtLogin = await desktopBridge.getLaunchAtLogin();
    set({ launchAtLogin });
  },

  refreshTraySettings: async () => {
    const traySettings = await desktopBridge.getTraySettings();
    set({ traySettings });
  },

  refreshNotificationSettings: async () => {
    const notificationSettings = await desktopBridge.getNotificationSettings();
    set({ notificationSettings });
  },

  setInstanceUrl: async (url: string) => {
    const normalized = await desktopBridge.setInstanceUrl(url);
    if (normalized) {
      set((state) => ({
        hello: state.hello ? { ...state.hello, instanceUrl: normalized } : state.hello,
      }));
    }
    return normalized;
  },

  syncApiKey: async (apiKey: string) => {
    const ok = await desktopBridge.syncApiKeyToDesktop(apiKey);
    if (ok) {
      await get().refreshCredentialStatus();
    }
    return ok;
  },

  clearCredential: async () => {
    const ok = await desktopBridge.clearDesktopCredential();
    if (ok) {
      await get().refreshCredentialStatus();
    }
    return ok;
  },

  pickFolder: async () => {
    return desktopBridge.pickFolder();
  },

  pickMoveDestinationFolder: async () => {
    return desktopBridge.pickMoveDestinationFolder();
  },

  saveWatcherConfig: async (config: FolderWatcherConfig) => {
    const ok = await desktopBridge.setFolderWatcherConfig(config);
    if (ok) {
      await Promise.all([get().refreshWatcherConfig(), get().refreshWatcherStatus()]);
    }
    return ok;
  },

  startWatcher: async (scanExisting = false) => {
    const ok = await desktopBridge.startFolderWatcher(scanExisting);
    if (ok) {
      await get().refreshWatcherStatus();
    }
    return ok;
  },

  stopWatcher: async () => {
    const ok = await desktopBridge.stopFolderWatcher();
    if (ok) {
      await get().refreshWatcherStatus();
    }
    return ok;
  },

  setLaunchAtLoginEnabled: async (enabled: boolean) => {
    const previous = get().launchAtLogin;
    set({
      launchAtLogin: {
        enabled,
        osEnabled: previous?.osEnabled ?? false,
        requiresApproval: previous?.requiresApproval,
      },
    });

    try {
      const status = await desktopBridge.setLaunchAtLogin(enabled);
      if (status) {
        set({ launchAtLogin: status });
      } else {
        set({ launchAtLogin: previous });
      }
      return status;
    } catch (error) {
      set({ launchAtLogin: previous });
      throw error;
    }
  },

  saveTraySettings: async (settings: TraySettings) => {
    const previous = get().traySettings;
    set({ traySettings: settings });
    try {
      const saved = await desktopBridge.setTraySettings(settings);
      if (saved) {
        set({ traySettings: saved });
      } else {
        set({ traySettings: previous });
      }
      return saved;
    } catch (error) {
      set({ traySettings: previous });
      throw error;
    }
  },

  saveNotificationSettings: async (settings: NotificationSettings) => {
    const previous = get().notificationSettings;
    set({ notificationSettings: settings });
    try {
      const saved = await desktopBridge.setNotificationSettings(settings);
      if (saved) {
        set({ notificationSettings: saved });
      } else {
        set({ notificationSettings: previous });
      }
      return saved;
    } catch (error) {
      set({ notificationSettings: previous });
      throw error;
    }
  },

  sendTestNotification: async () => {
    return desktopBridge.showTestNotification();
  },

  checkForUpdate: async () => {
    const update = await desktopBridge.checkForUpdate();
    if (update) {
      set({ pendingUpdate: update });
    }
    return update;
  },

  installUpdate: async () => {
    return desktopBridge.installUpdate();
  },
}));

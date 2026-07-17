import { create } from 'zustand';
import * as desktopBridge from '@/desktop/desktopBridge';
import * as desktopEvents from '@/desktop/events';
import type {
  CredentialStatus,
  FolderWatcherConfig,
  HelloResponse,
  LaunchAtLoginStatus,
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
  initialize: () => Promise<void>;
  retryInitialize: () => Promise<void>;
  refreshHello: () => Promise<void>;
  refreshCredentialStatus: () => Promise<void>;
  refreshWatcherConfig: () => Promise<void>;
  refreshWatcherStatus: () => Promise<void>;
  refreshLaunchAtLogin: () => Promise<void>;
  setInstanceUrl: (url: string) => Promise<string | null>;
  syncApiKey: (apiKey: string) => Promise<boolean>;
  clearCredential: () => Promise<boolean>;
  pickFolder: () => Promise<string | null>;
  pickMoveDestinationFolder: () => Promise<string | null>;
  saveWatcherConfig: (config: FolderWatcherConfig) => Promise<boolean>;
  startWatcher: (scanExisting?: boolean) => Promise<boolean>;
  stopWatcher: () => Promise<boolean>;
  setLaunchAtLoginEnabled: (enabled: boolean) => Promise<LaunchAtLoginStatus | null>;
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
  const hello = await desktopBridge.hello();
  const credentialStatus = await desktopBridge.getCredentialStatus();
  const watcherConfig = await desktopBridge.getFolderWatcherConfig();
  const watcherStatus = await desktopBridge.getFolderWatcherStatus();
  const launchAtLogin = await desktopBridge.getLaunchAtLogin();

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

  setInstanceUrl: async (url: string) => {
    const normalized = await desktopBridge.setInstanceUrl(url);
    if (normalized) {
      await get().refreshHello();
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
}));

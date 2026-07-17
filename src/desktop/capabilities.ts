export const WEB_BRIDGE_VERSION = 1;

export type DesktopPlatform = 'windows' | 'macos' | 'linux';

export type DesktopFeatureMap = {
  secureCredentials?: { version: number; canStoreApiKey: boolean };
  instanceUrl?: { version: number; canCustomize: boolean };
  folderPicker?: { version: number };
  folderWatcher?: { version: number; recursive?: boolean };
  backgroundUploads?: { version: number; maxFileBytes?: number };
  nativeNotifications?: { version: number };
  tray?: { version: number };
  launchAtLogin?: { version: number };
  updater?: { version: number };
};

export type DesktopCapabilities = {
  protocolVersion: number;
  appVersion?: string;
  platform?: DesktopPlatform;
  features: DesktopFeatureMap;
};

export type HelloResponse = {
  protocolVersion: number;
  appVersion: string;
  buildChannel: string;
  platform: DesktopPlatform;
  capabilities: DesktopCapabilities;
  minimumSupportedWebBridgeVersion: number;
  instanceUrl: string;
};

export type CredentialStatus = {
  hasApiKey: boolean;
  lastUpdatedAt: string | null;
};

export type PostUploadAction = 'delete' | 'moveToUploaded' | 'moveToCustom';

export type TorrentUploadOptions = {
  seed: number;
  allowZip: boolean;
  asQueued: boolean;
  addOnlyIfCached: boolean;
};

export type FolderWatcherConfig = {
  enabled: boolean;
  watchPath: string | null;
  postUploadAction: PostUploadAction;
  customMovePath: string | null;
  torrentOptions: TorrentUploadOptions;
  scanExistingOnEnable: boolean;
  stableFileMs: number;
};

export type WatcherActivityEntry = {
  filename: string;
  timestamp: string;
  result: string;
  detail?: string | null;
};

export type WatcherStatus = {
  running: boolean;
  watchPath: string | null;
  queueDepth: number;
  lastError: string | null;
  uploadsToday: number;
  activity: WatcherActivityEntry[];
};

export type LaunchAtLoginStatus = {
  enabled: boolean;
  osEnabled: boolean;
  requiresApproval?: boolean;
};

export type TraySettings = {
  closeToTray: boolean;
  minimizeToTray: boolean;
  startHidden: boolean;
};

export type NotificationSettings = {
  nativeNotifications: boolean;
  notifyOnUploadSuccess: boolean;
  notifyOnUploadFailure: boolean;
};

export type UpdateInfo = {
  version: string;
  currentVersion: string;
  notes?: string | null;
};

export type UpdateProgress = {
  downloaded: number;
  total?: number | null;
};

export function hasFeature(
  capabilities: DesktopCapabilities | null | undefined,
  feature: keyof DesktopFeatureMap
): boolean {
  return Boolean(capabilities?.features?.[feature]);
}

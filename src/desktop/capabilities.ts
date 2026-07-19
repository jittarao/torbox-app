export const WEB_BRIDGE_VERSION = 1;

export type DesktopPlatform = 'windows' | 'macos' | 'linux';

export type DesktopFeatureMap = {
  secureCredentials?: { version: number; canStoreApiKey: boolean };
  instanceUrl?: { version: number; canCustomize: boolean };
  folderPicker?: { version: number };
  folderWatcher?: { version: number; recursive?: boolean; maxRules?: number };
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

export type WatchRule = {
  id: string;
  enabled: boolean;
  watchPath: string | null;
  postUploadAction: PostUploadAction;
  customMovePath: string | null;
  torrentOptions: TorrentUploadOptions;
  scanExistingOnEnable: boolean;
};

export type FolderWatcherConfig = {
  rules: WatchRule[];
};

export type WatchRuleStatus = {
  ruleId: string;
  watchPath: string | null;
  enabled: boolean;
  active: boolean;
  queueDepth: number;
  uploadsToday: number;
  lastError: string | null;
};

export type WatcherStatus = {
  running: boolean;
  queueDepth: number;
  lastError: string | null;
  uploadsToday: number;
  rules: WatchRuleStatus[];
};

export type LaunchAtLoginStatus = {
  enabled: boolean;
  osEnabled: boolean;
  requiresApproval?: boolean;
};

export type BackgroundPresence = 'dock' | 'tray';

export type TraySettings = {
  backgroundPresence: BackgroundPresence;
  startHidden: boolean;
};

export type NotificationSettings = {
  nativeNotifications: boolean;
  notifyOnUploadSuccess: boolean;
  notifyOnUploadFailure: boolean;
  notifyOnTorboxNotifications: boolean;
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

export function folderWatcherSupportsMultiRule(
  capabilities: DesktopCapabilities | null | undefined
): boolean {
  return (capabilities?.features?.folderWatcher?.version ?? 0) >= 2;
}

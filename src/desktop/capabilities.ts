export const WEB_BRIDGE_VERSION = 1;

export type DesktopPlatform = 'windows' | 'macos' | 'linux';

export type DesktopFeatureMap = {
  secureCredentials?: { version: number; canStoreApiKey: boolean };
  instanceUrl?: { version: number; canCustomize: boolean };
  folderWatcher?: { version: number; recursive?: boolean };
  nativeNotifications?: { version: number };
  tray?: { version: number };
  launchAtLogin?: { version: number };
  backgroundUploads?: { version: number; maxFileBytes?: number };
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

export function hasFeature(
  capabilities: DesktopCapabilities | null | undefined,
  feature: keyof DesktopFeatureMap
): boolean {
  return Boolean(capabilities?.features?.[feature]);
}

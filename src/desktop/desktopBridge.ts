import type {
  HelloResponse,
  CredentialStatus,
  DesktopFeatureMap,
  FolderWatcherConfig,
  LaunchAtLoginStatus,
  NotificationSettings,
  TraySettings,
  UpdateInfo,
  WatcherStatus,
} from '@/desktop/capabilities';
import { WEB_BRIDGE_VERSION, hasFeature } from '@/desktop/capabilities';

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, args);
}

let availabilityCache: boolean | null = null;
let helloCache: HelloResponse | null = null;

export function isTauriEnvironment(): boolean {
  return isTauriRuntime();
}

function hasBridgeFeature(feature: keyof DesktopFeatureMap): boolean {
  return hasFeature(helloCache?.capabilities, feature);
}

export async function isAvailable(): Promise<boolean> {
  if (!isTauriRuntime()) {
    availabilityCache = false;
    helloCache = null;
    return false;
  }

  if (availabilityCache !== null) {
    return availabilityCache;
  }

  try {
    await hello();
    availabilityCache = true;
    return true;
  } catch {
    availabilityCache = false;
    helloCache = null;
    return false;
  }
}

export function resetAvailabilityCache(): void {
  availabilityCache = null;
  helloCache = null;
}

export async function hello(): Promise<HelloResponse | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  const response = await invoke<HelloResponse>('desktop_hello');
  helloCache = response;
  if (response.minimumSupportedWebBridgeVersion > WEB_BRIDGE_VERSION) {
    console.warn(
      '[desktop] Installed app requires a newer web bridge. Update the hosted app or desktop shell.'
    );
  }
  return response;
}

export async function getInstanceUrl(): Promise<string | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('instanceUrl')) {
    return null;
  }
  return invoke<string>('get_instance_url');
}

export async function setInstanceUrl(url: string): Promise<string | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('instanceUrl')) {
    return null;
  }
  return invoke<string>('set_instance_url', { url });
}

export async function setLastWebPath(path: string): Promise<boolean> {
  if (!(await isAvailable())) {
    return false;
  }
  await invoke('set_last_web_path', { path });
  return true;
}

export async function syncApiKeyToDesktop(apiKey: string): Promise<boolean> {
  if (!(await isAvailable()) || !hasBridgeFeature('secureCredentials')) {
    return false;
  }
  await invoke('sync_api_key_to_desktop', { key: apiKey });
  return true;
}

export async function getCredentialStatus(): Promise<CredentialStatus | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('secureCredentials')) {
    return null;
  }
  return invoke<CredentialStatus>('get_credential_status');
}

export async function clearDesktopCredential(): Promise<boolean> {
  if (!(await isAvailable()) || !hasBridgeFeature('secureCredentials')) {
    return false;
  }
  await invoke('clear_desktop_credential');
  return true;
}

export async function pickFolder(): Promise<string | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('folderPicker')) {
    return null;
  }
  const picked = await invoke<string | null>('pick_folder');
  return picked ?? null;
}

export async function pickMoveDestinationFolder(): Promise<string | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('folderPicker')) {
    return null;
  }
  const picked = await invoke<string | null>('pick_move_destination_folder');
  return picked ?? null;
}

export async function getFolderWatcherConfig(): Promise<FolderWatcherConfig | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('folderWatcher')) {
    return null;
  }
  return invoke<FolderWatcherConfig>('get_folder_watcher_config');
}

export async function setFolderWatcherConfig(config: FolderWatcherConfig): Promise<boolean> {
  if (!(await isAvailable()) || !hasBridgeFeature('folderWatcher')) {
    return false;
  }
  await invoke('set_folder_watcher_config', { config });
  return true;
}

export async function startFolderWatcher(scanExisting = false): Promise<boolean> {
  if (!(await isAvailable()) || !hasBridgeFeature('folderWatcher')) {
    return false;
  }
  await invoke('start_folder_watcher', { scanExisting });
  return true;
}

export async function stopFolderWatcher(): Promise<boolean> {
  if (!(await isAvailable()) || !hasBridgeFeature('folderWatcher')) {
    return false;
  }
  await invoke('stop_folder_watcher');
  return true;
}

export async function getFolderWatcherStatus(): Promise<WatcherStatus | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('folderWatcher')) {
    return null;
  }
  return invoke<WatcherStatus>('get_folder_watcher_status');
}

export async function getLaunchAtLogin(): Promise<LaunchAtLoginStatus | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('launchAtLogin')) {
    return null;
  }
  return invoke<LaunchAtLoginStatus>('get_launch_at_login');
}

export async function setLaunchAtLogin(enabled: boolean): Promise<LaunchAtLoginStatus | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('launchAtLogin')) {
    return null;
  }
  return invoke<LaunchAtLoginStatus>('set_launch_at_login', { enabled });
}

export async function getTraySettings(): Promise<TraySettings | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('tray')) {
    return null;
  }
  return invoke<TraySettings>('get_tray_settings');
}

export async function setTraySettings(tray: TraySettings): Promise<TraySettings | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('tray')) {
    return null;
  }
  return invoke<TraySettings>('set_tray_settings', { tray });
}

export async function getNotificationSettings(): Promise<NotificationSettings | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('nativeNotifications')) {
    return null;
  }
  return invoke<NotificationSettings>('get_notification_settings');
}

export async function setNotificationSettings(
  settings: NotificationSettings
): Promise<NotificationSettings | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('nativeNotifications')) {
    return null;
  }
  return invoke<NotificationSettings>('set_notification_settings', { settings });
}

export async function showTestNotification(): Promise<boolean> {
  if (!(await isAvailable()) || !hasBridgeFeature('nativeNotifications')) {
    return false;
  }
  await invoke('show_test_notification');
  return true;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!(await isAvailable()) || !hasBridgeFeature('updater')) {
    return null;
  }
  return invoke<UpdateInfo | null>('check_for_update_command');
}

export async function installUpdate(): Promise<boolean> {
  if (!(await isAvailable()) || !hasBridgeFeature('updater')) {
    return false;
  }
  await invoke('install_update_command');
  return true;
}

export const desktop = {
  isTauriEnvironment,
  isAvailable,
  hello,
  getInstanceUrl,
  setInstanceUrl,
  setLastWebPath,
  syncApiKeyToDesktop,
  getCredentialStatus,
  clearDesktopCredential,
  pickFolder,
  pickMoveDestinationFolder,
  getFolderWatcherConfig,
  setFolderWatcherConfig,
  startFolderWatcher,
  stopFolderWatcher,
  getFolderWatcherStatus,
  getLaunchAtLogin,
  setLaunchAtLogin,
  getTraySettings,
  setTraySettings,
  getNotificationSettings,
  setNotificationSettings,
  showTestNotification,
  checkForUpdate,
  installUpdate,
};

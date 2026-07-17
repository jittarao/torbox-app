import type { HelloResponse, CredentialStatus, DesktopFeatureMap } from '@/desktop/capabilities';
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

export const desktop = {
  isTauriEnvironment,
  isAvailable,
  hello,
  getInstanceUrl,
  setInstanceUrl,
  syncApiKeyToDesktop,
  getCredentialStatus,
  clearDesktopCredential,
};

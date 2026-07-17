import type { UnlistenFn } from '@tauri-apps/api/event';

const CAPABILITIES_CHANGED = 'desktop://capabilities-changed';

export async function onCapabilitiesChanged(handler: () => void): Promise<UnlistenFn | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  if (!isTauri) {
    return null;
  }

  const { listen } = await import('@tauri-apps/api/event');
  return listen(CAPABILITIES_CHANGED, () => {
    handler();
  });
}

export { CAPABILITIES_CHANGED };

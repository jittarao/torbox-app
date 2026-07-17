import type { UnlistenFn } from '@tauri-apps/api/event';

const CAPABILITIES_CHANGED = 'desktop://capabilities-changed';
const WATCHER_STATUS_CHANGED = 'desktop://watcher-status-changed';
const TORRENT_DETECTED = 'desktop://torrent-detected';
const UPLOAD_QUEUED = 'desktop://upload-queued';
const UPLOAD_SUCCEEDED = 'desktop://upload-succeeded';
const UPLOAD_FAILED = 'desktop://upload-failed';

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

async function listenEvent<T>(
  event: string,
  handler: (payload: T) => void
): Promise<UnlistenFn | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  if (!isTauri) {
    return null;
  }

  const { listen } = await import('@tauri-apps/api/event');
  return listen<T>(event, (eventPayload) => {
    handler(eventPayload.payload);
  });
}

export async function onWatcherStatusChanged(
  handler: (payload: import('@/desktop/capabilities').WatcherStatus) => void
): Promise<UnlistenFn | null> {
  return listenEvent(WATCHER_STATUS_CHANGED, handler);
}

export async function onTorrentDetected(
  handler: (payload: { filename: string; path: string }) => void
): Promise<UnlistenFn | null> {
  return listenEvent(TORRENT_DETECTED, handler);
}

export async function onUploadQueued(
  handler: (payload: { filename: string; fingerprint: string }) => void
): Promise<UnlistenFn | null> {
  return listenEvent(UPLOAD_QUEUED, handler);
}

export async function onUploadSucceeded(
  handler: (payload: {
    filename: string;
    uploadId?: string | null;
    movedTo?: string | null;
  }) => void
): Promise<UnlistenFn | null> {
  return listenEvent(UPLOAD_SUCCEEDED, handler);
}

export async function onUploadFailed(
  handler: (payload: { filename: string; error: string; willRetry: boolean }) => void
): Promise<UnlistenFn | null> {
  return listenEvent(UPLOAD_FAILED, handler);
}

export {
  CAPABILITIES_CHANGED,
  WATCHER_STATUS_CHANGED,
  TORRENT_DETECTED,
  UPLOAD_QUEUED,
  UPLOAD_SUCCEEDED,
  UPLOAD_FAILED,
};

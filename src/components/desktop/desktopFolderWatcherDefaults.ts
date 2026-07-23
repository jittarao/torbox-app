import type { FolderWatcherConfig, WatchRule } from '@/desktop/capabilities';

export function createDefaultWatchRule(): WatchRule {
  return {
    id: crypto.randomUUID(),
    enabled: false,
    watchPath: null,
    postUploadAction: 'moveToUploaded',
    customMovePath: null,
    torrentOptions: {
      seed: 1,
      allowZip: true,
      asQueued: false,
      addOnlyIfCached: false,
    },
    scanExistingOnEnable: false,
  };
}

export const DEFAULT_WATCHER_CONFIG: FolderWatcherConfig = {
  rules: [],
};

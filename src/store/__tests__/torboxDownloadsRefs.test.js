import { describe, expect, it, beforeEach } from 'bun:test';
import {
  beginFetchInProgress,
  endFetchInProgress,
  fetchInProgressKeysRef,
  getFetchInProgressKey,
  isFetchInProgress,
  resetDownloadSyncRefs,
} from '../torboxDownloadsRefs';

describe('torboxDownloadsRefs fetch in progress', () => {
  beforeEach(() => {
    resetDownloadSyncRefs('key-a');
  });

  it('tracks concurrent fetches per view type', () => {
    beginFetchInProgress('key-a', 'torrents');
    beginFetchInProgress('key-a', 'usenet');

    expect(isFetchInProgress('key-a', 'torrents')).toBe(true);
    expect(isFetchInProgress('key-a', 'usenet')).toBe(true);
    expect(isFetchInProgress('key-a', 'webdl')).toBe(false);
  });

  it('endFetchInProgress removes only the matching key', () => {
    beginFetchInProgress('key-a', 'torrents');
    beginFetchInProgress('key-a', 'usenet');

    endFetchInProgress('key-a', 'torrents');

    expect(isFetchInProgress('key-a', 'torrents')).toBe(false);
    expect(isFetchInProgress('key-a', 'usenet')).toBe(true);
  });

  it('resetDownloadSyncRefs clears all in-progress keys', () => {
    beginFetchInProgress('key-a', 'all');
    resetDownloadSyncRefs('key-b');
    expect(fetchInProgressKeysRef.current.size).toBe(0);
    expect(getFetchInProgressKey('key-b', 'torrents')).toBe('key-b:torrents');
  });
});

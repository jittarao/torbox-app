import { describe, expect, test } from 'bun:test';
import { getIdFieldForItem, resolveItemAssetType } from '../torboxDownloadsSelectors';

describe('getIdFieldForItem', () => {
  test('uses item asset type on all tab', () => {
    expect(getIdFieldForItem({ id: 1, assetType: 'usenet' }, 'all')).toBe('usenet_id');
    expect(getIdFieldForItem({ id: 1, assetType: 'webdl' }, 'all')).toBe('web_id');
    expect(getIdFieldForItem({ id: 1, assetType: 'torrents' }, 'all')).toBe('torrent_id');
  });

  test('uses active tab when item has no asset type', () => {
    expect(getIdFieldForItem({ id: 1 }, 'usenet')).toBe('usenet_id');
    expect(getIdFieldForItem({ id: 1 }, 'webdl')).toBe('web_id');
    expect(getIdFieldForItem({ id: 1 }, 'torrents')).toBe('torrent_id');
  });

  test('resolveItemAssetType defaults all tab to torrents without item type', () => {
    expect(resolveItemAssetType(null, 'all')).toBe('torrents');
  });
});

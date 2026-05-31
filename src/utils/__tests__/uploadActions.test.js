import { describe, expect, test } from 'bun:test';
import { resolveAssetTypeForItem } from '@/utils/uploadActions';

describe('resolveAssetTypeForItem', () => {
  test('maps usenet items to usenet endpoint even when hook defaults to torrents', () => {
    expect(resolveAssetTypeForItem({ type: 'usenet' }, 'torrents')).toBe('usenet');
  });

  test('maps magnet items to torrents', () => {
    expect(resolveAssetTypeForItem({ type: 'magnet' }, 'usenet')).toBe('torrents');
  });

  test('falls back to hook asset type for unknown item types', () => {
    expect(resolveAssetTypeForItem({ type: 'custom' }, 'webdl')).toBe('webdl');
  });
});

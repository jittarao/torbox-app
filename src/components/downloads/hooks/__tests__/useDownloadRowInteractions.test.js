import { describe, expect, it } from 'bun:test';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';

describe('download row selection helpers', () => {
  it('builds composite selection id for all-tab rows', () => {
    const row = { id: 42, assetType: 'usenet' };
    expect(getDownloadSelectionId(row)).toBe('usenet:42');
  });

  it('uses torrent id when asset type omitted', () => {
    const row = { id: 7 };
    expect(getDownloadSelectionId(row)).toBe('torrents:7');
  });
});

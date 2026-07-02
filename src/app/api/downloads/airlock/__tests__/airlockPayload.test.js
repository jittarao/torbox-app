import { describe, expect, test } from 'bun:test';
import {
  EDIT_CONFIG,
  buildEditPayload,
  findDownloadById,
  normalizeAssetType,
} from '../airlockPayload';

describe('airlockPayload', () => {
  test('maps supported asset types to edit endpoints and id fields', () => {
    expect(normalizeAssetType('torrents')).toBe('torrent');
    expect(normalizeAssetType('usenet')).toBe('usenet');
    expect(normalizeAssetType('webdownload')).toBe('webdl');
    expect(EDIT_CONFIG.torrent).toMatchObject({
      editEndpoint: '/api/torrents/edittorrent',
      idField: 'torrent_id',
    });
    expect(EDIT_CONFIG.usenet).toMatchObject({
      editEndpoint: '/api/usenet/editusenetdownload',
      idField: 'usenet_id',
    });
    expect(EDIT_CONFIG.webdl).toMatchObject({
      editEndpoint: '/api/webdl/editwebdownload',
      idField: 'webdl_id',
    });
  });

  test('finds current upstream item by id from object or list responses', () => {
    expect(findDownloadById({ data: { id: 42, name: 'single' } }, '42')).toEqual({
      id: 42,
      name: 'single',
    });
    expect(findDownloadById({ data: [{ id: 1 }, { id: 2 }] }, 2)).toEqual({ id: 2 });
    expect(findDownloadById({ data: [{ id: 1 }] }, 9)).toBeNull();
  });

  test('builds preserved TorBox edit payload without TBM tag mappings', () => {
    expect(
      buildEditPayload(
        {
          id: 123,
          name: 'Upstream name',
          tags: ['torbox-tag'],
          alternative_hashes: ['abc'],
        },
        'torrent_id',
        true
      )
    ).toEqual({
      torrent_id: 123,
      name: 'Upstream name',
      tags: ['torbox-tag'],
      alternative_hashes: ['abc'],
      airlocked: true,
    });
  });
});

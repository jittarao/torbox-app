import { describe, expect, test } from 'bun:test';
import {
  EDIT_CONFIG,
  buildEditPayload,
  findDownloadById,
  getAlternativeHashes,
  isIdInQueuedList,
  normalizeAssetType,
  normalizeEditableArray,
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

  test('normalizeEditableArray coerces non-arrays to empty arrays', () => {
    expect(normalizeEditableArray(null)).toEqual([]);
    expect(normalizeEditableArray('tag')).toEqual([]);
    expect(normalizeEditableArray(['a'])).toEqual(['a']);
  });

  test('getAlternativeHashes prefers snake_case and falls back to camelCase', () => {
    expect(getAlternativeHashes({ alternative_hashes: ['a'] })).toEqual(['a']);
    expect(getAlternativeHashes({ alternativeHashes: ['b'] })).toEqual(['b']);
    expect(getAlternativeHashes({ alternative_hashes: ['a'], alternativeHashes: ['b'] })).toEqual([
      'a',
    ]);
  });

  test('buildEditPayload preserves camelCase alternative hashes', () => {
    expect(
      buildEditPayload({ id: 1, name: 'x', alternativeHashes: ['hash'] }, 'torrent_id', false)
    ).toEqual({
      torrent_id: 1,
      name: 'x',
      tags: [],
      alternative_hashes: ['hash'],
      airlocked: false,
    });
  });

  test('isIdInQueuedList matches ids with string coercion', () => {
    expect(isIdInQueuedList({ data: [{ id: 7 }] }, '7')).toBe(true);
    expect(isIdInQueuedList({ data: [{ id: 7 }] }, 99)).toBe(false);
  });
});

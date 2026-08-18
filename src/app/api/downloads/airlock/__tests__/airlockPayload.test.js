import { describe, expect, test } from 'bun:test';
import {
  EDIT_CONFIG,
  buildEditPayload,
  findDownloadById,
  getAlternativeHashes,
  isIdInQueuedList,
  normalizeAssetType,
  normalizeEditableArray,
  normalizeEditName,
  normalizeEditTags,
  resolveEditResourceId,
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

  test('findDownloadById matches type-specific id fields', () => {
    expect(findDownloadById({ data: { usenet_id: 55, name: 'nzb' } }, 55)).toEqual({
      usenet_id: 55,
      name: 'nzb',
    });
    expect(findDownloadById({ data: [{ web_id: 9 }] }, 9)).toEqual({ web_id: 9 });
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
        true,
        123
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
      buildEditPayload({ id: 1, name: 'x', alternativeHashes: ['hash'] }, 'torrent_id', false, 1)
    ).toEqual({
      torrent_id: 1,
      name: 'x',
      tags: [],
      alternative_hashes: ['hash'],
      airlocked: false,
    });
  });

  test('buildEditPayload resolves usenet_id and normalizes tag objects', () => {
    expect(
      buildEditPayload(
        { usenet_id: 55, name: 'Usenet item', tags: [{ id: 1, name: 'keep' }] },
        'usenet_id',
        false,
        55
      )
    ).toEqual({
      usenet_id: 55,
      name: 'Usenet item',
      tags: ['keep'],
      alternative_hashes: [],
      airlocked: false,
    });
  });

  test('buildEditPayload resolves webdl_id from web_id', () => {
    expect(
      buildEditPayload({ web_id: 9, name: 'Web download', tags: ['x'] }, 'webdl_id', true, 9)
    ).toEqual({
      webdl_id: 9,
      name: 'Web download',
      tags: ['x'],
      alternative_hashes: [],
      airlocked: true,
    });
  });

  test('normalizeEditName falls back when upstream name is blank', () => {
    expect(normalizeEditName('  ', 77)).toBe('Download 77');
    expect(normalizeEditName(' valid ', 77)).toBe('valid');
  });

  test('normalizeEditTags keeps string tags and maps tag objects to names', () => {
    expect(normalizeEditTags(['a', { name: 'b' }, { id: 1 }])).toEqual(['a', 'b']);
  });

  test('resolveEditResourceId prefers type-specific fields', () => {
    expect(resolveEditResourceId({ usenet_id: 55 }, 'usenet_id', 99)).toBe(55);
    expect(resolveEditResourceId({ web_id: 9 }, 'webdl_id', 9)).toBe(9);
  });

  test('isIdInQueuedList matches ids with string coercion', () => {
    expect(isIdInQueuedList({ data: [{ id: 7 }] }, '7')).toBe(true);
    expect(isIdInQueuedList({ data: [{ id: 7 }] }, 99)).toBe(false);
    expect(isIdInQueuedList({ data: [{ usenet_id: 7 }] }, '7')).toBe(true);
  });
});

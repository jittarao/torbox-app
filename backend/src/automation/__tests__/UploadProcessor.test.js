import { describe, expect, test } from 'bun:test';
import { extractTorboxTorrentResult } from '../UploadProcessor.js';

function makeResponse(data) {
  return { status: 200, data: { success: true, data } };
}

describe('extractTorboxTorrentResult', () => {
  test('torrent response extracts hash, torrent_id, and auth_id', () => {
    const response = makeResponse({
      hash: 'abc123',
      torrent_id: 42,
      auth_id: 'auth-42',
    });
    const result = extractTorboxTorrentResult(response, 'torrent');
    expect(result.torboxHash).toBe('abc123');
    expect(result.torboxTorrentId).toBe(42);
    expect(result.torboxAuthId).toBe('auth-42');
  });

  test('usenet response extracts usenet_id and keeps hash null', () => {
    const response = makeResponse({
      usenet_id: 99,
      auth_id: 'auth-99',
    });
    const result = extractTorboxTorrentResult(response, 'usenet');
    expect(result.torboxHash).toBeNull();
    expect(result.torboxTorrentId).toBe(99);
    expect(result.torboxAuthId).toBe('auth-99');
  });

  test('webdl response extracts webdownload_id and keeps hash null', () => {
    const response = makeResponse({
      webdownload_id: 1133079,
      auth_id: 'auth-web',
    });
    const result = extractTorboxTorrentResult(response, 'webdl');
    expect(result.torboxHash).toBeNull();
    expect(result.torboxTorrentId).toBe(1133079);
    expect(result.torboxAuthId).toBe('auth-web');
  });

  test('missing data object returns nulls', () => {
    const result = extractTorboxTorrentResult({ status: 200, data: {} }, 'torrent');
    expect(result.torboxHash).toBeNull();
    expect(result.torboxTorrentId).toBeNull();
    expect(result.torboxAuthId).toBeNull();
  });
});

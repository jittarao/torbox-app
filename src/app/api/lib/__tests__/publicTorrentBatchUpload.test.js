import { describe, expect, test } from 'bun:test';
import { validatePublicTorrentBatchUploads } from '../publicTorrentBatchUpload.js';

describe('validatePublicTorrentBatchUploads', () => {
  test('accepts torrent-only batches', () => {
    expect(validatePublicTorrentBatchUploads([{ type: 'torrent', upload_type: 'magnet' }])).toBe(
      null
    );
  });

  test('rejects ambiguous non-torrent batches', () => {
    expect(validatePublicTorrentBatchUploads([{ type: 'usenet', upload_type: 'file' }])).toBe(
      'Only torrent uploads are supported by this endpoint'
    );
  });

  test('requires a non-empty uploads array', () => {
    expect(validatePublicTorrentBatchUploads([])).toBe(
      'uploads array is required and must not be empty'
    );
  });
});

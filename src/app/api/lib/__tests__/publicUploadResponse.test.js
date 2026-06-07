import { describe, expect, test } from 'bun:test';
import { toPublicUploadResponse } from '../publicUploadResponse.js';

describe('toPublicUploadResponse', () => {
  test('maps queued uploads to TorBox-style envelope with nullable result fields', () => {
    expect(
      toPublicUploadResponse({
        id: 42,
        status: 'queued',
        queue_order: 5,
      })
    ).toEqual({
      success: true,
      error: null,
      detail: 'Torrent Queued Successfully',
      data: {
        upload_id: 42,
        status: 'queued',
        queue_order: 5,
        hash: null,
        torrent_id: null,
        auth_id: null,
      },
    });
  });

  test('includes stored TorBox result fields for completed uploads', () => {
    expect(
      toPublicUploadResponse({
        id: 42,
        status: 'completed',
        queue_order: 5,
        torbox_hash: 'hash-value',
        torbox_torrent_id: 123,
        torbox_auth_id: 'auth-value',
      }).data
    ).toEqual({
      upload_id: 42,
      status: 'completed',
      queue_order: 5,
      hash: 'hash-value',
      torrent_id: 123,
      auth_id: 'auth-value',
    });
  });

  test('includes error_message for failed uploads', () => {
    expect(
      toPublicUploadResponse({
        id: 42,
        status: 'failed',
        queue_order: 5,
        error_message: 'Upload failed',
      }).data.error_message
    ).toBe('Upload failed');
  });
});

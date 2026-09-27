import { describe, expect, test } from 'bun:test';
import {
  validatePublicTorrentBatchUploads,
  queuePublicTorrentBatchUploads,
} from '../publicTorrentBatchUpload.js';

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

describe('queuePublicTorrentBatchUploads item identity', () => {
  test('keeps original indices when staging fails and echoes index/name', async () => {
    const originalFetch = globalThis.fetch;
    let capturedBatchBody = null;

    try {
      globalThis.fetch = async (url, options) => {
        const target = String(url);

        if (target.endsWith('/api/uploads/file')) {
          const body = JSON.parse(options.body);
          if (body.filename === 'c.torrent') {
            return new Response(JSON.stringify({ success: false, error: 'Failed to save file' }), {
              status: 400,
            });
          }
          return new Response(
            JSON.stringify({ success: true, data: { file_path: `staged/${body.filename}` } }),
            { status: 200 }
          );
        }

        if (target.endsWith('/api/uploads/batch')) {
          capturedBatchBody = JSON.parse(options.body);
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                uploads: [
                  { id: 1, status: 'queued', queue_order: 0, index: 0, name: 'a.torrent' },
                  { id: 2, status: 'queued', queue_order: 1, index: 1, name: 'B' },
                ],
              },
              meta: { total: 2, successful: 2, failed: 0 },
            }),
            { status: 200 }
          );
        }

        throw new Error(`Unexpected fetch: ${target}`);
      };

      const request = new Request('http://localhost/api/v1/torrents/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploads: [
            {
              type: 'torrent',
              upload_type: 'file',
              file_data: 'dGVzdA==',
              filename: 'a.torrent',
              name: 'a.torrent',
            },
            {
              type: 'torrent',
              upload_type: 'magnet',
              url: 'magnet:?xt=urn:btih:b',
              name: 'B',
            },
            {
              type: 'torrent',
              upload_type: 'file',
              file_data: 'dGVzdA==',
              filename: 'c.torrent',
              name: 'c.torrent',
            },
            {
              type: 'torrent',
              upload_type: 'file',
              filename: 'd.torrent',
              name: 'd.torrent',
            },
          ],
        }),
      });

      const response = await queuePublicTorrentBatchUploads(request, 'test-key');
      const body = await response.json();

      // Only items that staged successfully are forwarded to the backend.
      expect(capturedBatchBody.uploads).toHaveLength(2);
      expect(capturedBatchBody.uploads.map((u) => u.index)).toEqual([0, 1]);
      expect(capturedBatchBody.uploads[0].file_path).toBe('staged/a.torrent');

      expect(body.data.uploads.map((u) => u.index)).toEqual([0, 1]);
      expect(body.data.uploads.map((u) => u.name)).toEqual(['a.torrent', 'B']);

      // Staging failures keep their original request index and a stable code.
      expect(body.data.errors.map((e) => e.index)).toEqual([2, 3]);
      expect(body.data.errors.map((e) => e.code)).toEqual([
        'file_stage_failed',
        'file_stage_failed',
      ]);
      expect(body.data.errors[0].name).toBe('c.torrent');
      expect(body.data.errors[1].upload.name).toBe('d.torrent');

      expect(body.meta).toEqual({ total: 4, successful: 2, failed: 2 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

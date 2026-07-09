import { describe, expect, test, mock, afterEach } from 'bun:test';

describe('DELETE /api/torrents protection', () => {
  afterEach(() => {
    mock.restore();
  });

  test('returns 403 when download is protected', async () => {
    mock.module('@/app/api/lib/requireTorboxApiKey', () => ({
      requireTorboxApiKey: async () => ({ apiKey: 'test-key' }),
    }));
    mock.module('@/app/api/lib/downloadProtectionGuard', () => ({
      guardDestructiveOrRespond: async () =>
        Response.json(
          {
            success: false,
            error: 'Download is protected',
            code: 'DOWNLOAD_PROTECTED',
            blocked_ids: ['42'],
          },
          { status: 403 }
        ),
    }));
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: mock(() => Promise.resolve(new Response())),
      isTorboxFetchTimeout: () => false,
    }));

    const { DELETE } = await import('../route.js');
    const response = await DELETE(
      new Request('http://localhost/api/torrents', {
        method: 'DELETE',
        body: JSON.stringify({ id: 42 }),
      })
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('DOWNLOAD_PROTECTED');
    expect(body.blocked_ids).toEqual(['42']);
  });
});

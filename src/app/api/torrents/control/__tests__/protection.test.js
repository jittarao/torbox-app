import { describe, expect, test, mock, afterEach } from 'bun:test';

describe('POST /api/torrents/control protection', () => {
  afterEach(() => {
    mock.restore();
  });

  test('blocks stop_seeding for protected download', async () => {
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
            blocked_ids: ['7'],
          },
          { status: 403 }
        ),
    }));
    const torboxFetch = mock(() => Promise.resolve(new Response()));
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch,
    }));

    const { POST } = await import('../route.js');
    const response = await POST(
      new Request('http://localhost/api/torrents/control', {
        method: 'POST',
        body: JSON.stringify({ torrent_id: 7, operation: 'stop_seeding' }),
      })
    );

    expect(response.status).toBe(403);
    expect(torboxFetch).not.toHaveBeenCalled();
  });

  test('allows non-destructive operations without protection check', async () => {
    const guardDestructiveOrRespond = mock(async () => null);
    const torboxFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    mock.module('@/app/api/lib/requireTorboxApiKey', () => ({
      requireTorboxApiKey: async () => ({ apiKey: 'test-key' }),
    }));
    mock.module('@/app/api/lib/downloadProtectionGuard', () => ({
      guardDestructiveOrRespond,
    }));
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch,
    }));
    mock.module('@/components/constants', () => ({
      API_BASE: 'https://api.test',
      API_VERSION: 'v1',
      TORBOX_MANAGER_VERSION: 'test',
    }));

    const { POST } = await import('../route.js');
    const response = await POST(
      new Request('http://localhost/api/torrents/control', {
        method: 'POST',
        body: JSON.stringify({ torrent_id: 7, operation: 'force_start' }),
      })
    );

    expect(response.status).toBe(200);
    expect(guardDestructiveOrRespond).not.toHaveBeenCalled();
    expect(torboxFetch).toHaveBeenCalled();
  });
});

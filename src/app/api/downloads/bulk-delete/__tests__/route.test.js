import { describe, expect, test, mock, afterEach } from 'bun:test';

describe('/api/downloads/bulk-delete', () => {
  afterEach(() => {
    mock.restore();
  });

  test('returns 401 when API key is missing', async () => {
    mock.module('@/app/api/lib/requireTorboxApiKey', () => ({
      requireTorboxApiKey: async () => ({
        response: Response.json({ success: false, error: 'API key is required' }, { status: 401 }),
      }),
    }));

    const { POST } = await import('../route.js');
    const response = await POST(
      new Request('http://localhost/api/downloads/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: [1, 2], assetType: 'torrents' }),
      })
    );

    expect(response.status).toBe(401);
  });

  test('asserts protection once and deletes only allowed ids', async () => {
    const assertCalls = [];
    const deleteCalls = [];

    mock.module('@/app/api/lib/requireTorboxApiKey', () => ({
      requireTorboxApiKey: async () => ({ apiKey: 'test-key' }),
    }));
    mock.module('@/app/api/lib/downloadProtectionGuard', () => ({
      assertDestructiveAllowed: async (apiKey, ids, operation) => {
        assertCalls.push({ apiKey, ids, operation });
        return { allowed: ['2'], blocked: ['1'] };
      },
      protectedResponse: (blockedIds) =>
        Response.json({ success: false, blocked_ids: blockedIds }, { status: 403 }),
    }));
    mock.module('@/app/api/lib/deleteDownloadItem', () => ({
      deleteDownloadItem: async ({ id, skipProtectionCheck }) => {
        deleteCalls.push({ id, skipProtectionCheck });
        return Response.json({ success: true });
      },
      deleteDownloadItemErrorResponse: () => Response.json({ success: false }, { status: 500 }),
      DELETE_CONFIG: { torrents: {}, usenet: {}, webdl: {} },
    }));

    const { POST } = await import('../route.js');
    const response = await POST(
      new Request('http://localhost/api/downloads/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: [1, 2], assetType: 'torrents' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.deleted_ids).toEqual(['2']);
    expect(body.blocked_ids).toEqual(['1']);
    expect(assertCalls).toHaveLength(1);
    expect(assertCalls[0].ids).toEqual(['1', '2']);
    expect(assertCalls[0].operation).toBe('delete');
    expect(deleteCalls).toEqual([{ id: '2', skipProtectionCheck: true }]);
  });
});

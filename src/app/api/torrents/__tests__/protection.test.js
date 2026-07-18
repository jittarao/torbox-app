import { describe, expect, test, mock, afterEach, afterAll } from 'bun:test';

const realRequireTorboxApiKey = await import('@/app/api/lib/requireTorboxApiKey');
const realDownloadProtectionGuard = await import('@/app/api/lib/downloadProtectionGuard');
const realTorboxFetch = await import('@/app/api/lib/torboxFetch');

const mockedApiModuleRestores = [
  ['@/app/api/lib/requireTorboxApiKey', realRequireTorboxApiKey],
  ['@/app/api/lib/downloadProtectionGuard', realDownloadProtectionGuard],
  ['@/app/api/lib/torboxFetch', realTorboxFetch],
];

function restoreMockedApiModules() {
  for (const [modulePath, moduleExports] of mockedApiModuleRestores) {
    mock.module(modulePath, () => moduleExports);
  }
}

describe('DELETE /api/torrents protection', () => {
  afterEach(() => {
    mock.restore();
  });

  afterAll(() => {
    restoreMockedApiModules();
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

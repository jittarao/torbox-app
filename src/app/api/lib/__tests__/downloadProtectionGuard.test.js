import { describe, expect, test, mock, afterEach, afterAll } from 'bun:test';

const realBackendCheck = await import('@/utils/backendCheck');
const realBackendRequest = await import('@/utils/backendRequest');

function restoreMockedModules() {
  mock.module('@/utils/backendCheck', () => realBackendCheck);
  mock.module('@/utils/backendRequest', () => realBackendRequest);
}

describe('assertDestructiveAllowed', () => {
  afterEach(() => {
    mock.restore();
    restoreMockedModules();
  });

  afterAll(() => {
    restoreMockedModules();
  });

  test('fails open when the backend assert times out', async () => {
    mock.module('@/utils/backendCheck', () => ({
      isBackendDisabled: () => false,
    }));
    mock.module('@/utils/backendRequest', () => ({
      backendFetch: async () => {
        const error = new Error('This operation was aborted');
        error.name = 'TimeoutError';
        throw error;
      },
    }));

    const { assertDestructiveAllowed } = await import('../downloadProtectionGuard.js');
    await expect(assertDestructiveAllowed('test-key', [1, 2], 'delete')).resolves.toEqual({
      allowed: ['1', '2'],
      blocked: [],
    });
  });
});

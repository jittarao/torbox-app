import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  checkBackendAvailability,
  getBackendModeSnapshot,
  resetBackendModeCacheForTests,
} from '@/utils/backendModeCache';

describe('backendModeCache', () => {
  let fetchCalls = 0;

  beforeEach(() => {
    resetBackendModeCacheForTests();
    fetchCalls = 0;
    globalThis.fetch = mock(async () => {
      fetchCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        ok: true,
        json: async () => ({ available: true }),
      };
    });
  });

  afterEach(() => {
    mock.restore();
  });

  test('concurrent checkBackendAvailability calls share one status request', async () => {
    const first = checkBackendAvailability();
    const second = checkBackendAvailability();

    await Promise.all([first, second]);

    expect(fetchCalls).toBe(1);
    expect(getBackendModeSnapshot()).toMatchObject({
      mode: 'backend',
      hasChecked: true,
      isChecking: false,
    });
  });
});

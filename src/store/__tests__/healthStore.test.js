import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { useHealthStore } from '@/store/healthStore';
import {
  checkBackendAvailability,
  getBackendModeSnapshot,
  resetBackendModeCacheForTests,
} from '@/utils/backendModeCache';

describe('healthStore.checkBackendHealth', () => {
  let fetchCalls = 0;

  beforeEach(() => {
    resetBackendModeCacheForTests();
    fetchCalls = 0;
    useHealthStore.setState({
      backendHealth: { status: 'unknown', message: null, responseTime: null },
    });
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

  test('awaits an in-flight backend mode check instead of issuing a second status request', async () => {
    const inFlight = checkBackendAvailability();
    expect(getBackendModeSnapshot().isChecking).toBe(true);

    const healthCheck = useHealthStore.getState().checkBackendHealth();

    await Promise.all([inFlight, healthCheck]);

    expect(fetchCalls).toBe(1);
    expect(useHealthStore.getState().backendHealth.status).toBe('healthy');
  });
});

import { describe, expect, test, afterEach, mock } from 'bun:test';
import {
  backendProxyErrorResponse,
  isExpectedApiError,
  logRouteError,
  resetRouteLogForTests,
} from '../routeLog.js';

describe('routeLog', () => {
  afterEach(() => {
    resetRouteLogForTests();
    mock.restore();
  });

  test('isExpectedApiError recognizes plan and auth faults', () => {
    expect(isExpectedApiError(new Error('PLAN_RESTRICTED_FEATURE'))).toBe(true);
    expect(isExpectedApiError(new Error('AUTH_ERROR'))).toBe(true);
    expect(isExpectedApiError(new Error('Backend responded with status: 404'))).toBe(true);
    expect(isExpectedApiError(new Error('SQL blew up'))).toBe(false);
  });

  test('logRouteError rate-limits expected faults without stacks', () => {
    const warn = mock(() => {});
    const error = mock(() => {});
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = warn;
    console.error = error;

    try {
      logRouteError('Error fetching torrents', new Error('PLAN_RESTRICTED_FEATURE'));
      logRouteError('Error fetching torrents', new Error('PLAN_RESTRICTED_FEATURE'));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(error).not.toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  test('logRouteError skips negative-cache list-sync rethrows entirely', () => {
    const warn = mock(() => {});
    const error = mock(() => {});
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = warn;
    console.error = error;

    try {
      const cached = new Error('PLAN_RESTRICTED_FEATURE');
      cached.listSyncCached = true;
      logRouteError('Error fetching torrents', cached);
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  test('TimeoutError is expected and logged without a second-arg dump', () => {
    const warn = mock(() => {});
    const error = mock(() => {});
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = warn;
    console.error = error;

    try {
      const timeout = new Error('The operation was aborted due to timeout');
      timeout.name = 'TimeoutError';
      expect(isExpectedApiError(timeout)).toBe(true);
      logRouteError('Error proxying stremio stream', timeout);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('aborted due to timeout');
      expect(error).not.toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  test('isExpectedApiError recognizes upstream 5xx status messages', () => {
    expect(isExpectedApiError(new Error('API responded with status: 500'))).toBe(true);
    expect(isExpectedApiError(new Error('API responded with status: 404'))).toBe(false);
  });

  test('backendProxyErrorResponse rate-limits unregistered users across routes', async () => {
    const warn = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warn;

    try {
      backendProxyErrorResponse(
        { status: 404, data: { success: false, error: 'User not registered' } },
        'Error fetching tags from backend'
      );
      backendProxyErrorResponse(
        { status: 404, data: { success: false, error: 'User not registered' } },
        'Error fetching custom views from backend'
      );
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('backendProxyErrorResponse preserves 404 for unregistered users', async () => {
    const warn = mock(() => {});
    const originalWarn = console.warn;
    console.warn = warn;

    try {
      const response = backendProxyErrorResponse(
        { status: 404, data: { success: false, error: 'User not registered' } },
        'Error fetching tags from backend'
      );
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body).toEqual({ success: false, error: 'User not registered' });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      console.warn = originalWarn;
    }
  });
});

import { describe, expect, test } from 'bun:test';
import ApiClient, {
  isActiveDownloadLimitError,
  isTorboxApplicationServerError,
} from '../ApiClient.js';

function axiosError({ status, data, code, message } = {}) {
  const error = new Error(message || 'Request failed');
  if (code) error.code = code;
  if (status != null) {
    error.response = { status, data, statusText: 'Error' };
  }
  return error;
}

describe('ApiClient.isConnectionError', () => {
  const client = new ApiClient('fake-api-key');

  test('treats network failures as connection errors', () => {
    expect(client.isConnectionError(axiosError({ code: 'ECONNREFUSED' }))).toBe(true);
    expect(client.isConnectionError(axiosError({ message: 'Network Error' }))).toBe(true);
  });

  test('treats gateway 502/503/504 as connection errors', () => {
    expect(client.isConnectionError(axiosError({ status: 502, data: 'Bad Gateway' }))).toBe(true);
    expect(client.isConnectionError(axiosError({ status: 503, data: {} }))).toBe(true);
  });

  test('does not treat TorBox application 500s as connection/outage errors', () => {
    expect(
      client.isConnectionError(
        axiosError({
          status: 500,
          data: {
            error: 'DATABASE_ERROR',
            detail: 'You have reached your active download limit of 10. Please upgrade your plan.',
          },
        })
      )
    ).toBe(false);

    expect(
      client.isConnectionError(
        axiosError({
          status: 500,
          data: {
            error: 'DATABASE_ERROR',
            data: 'You have reached your active download limit of 10.',
          },
        })
      )
    ).toBe(false);
  });

  test('still treats opaque 500s as connection errors', () => {
    expect(
      client.isConnectionError(axiosError({ status: 500, data: 'Internal Server Error' }))
    ).toBe(true);
    expect(client.isConnectionError(axiosError({ status: 500, data: {} }))).toBe(true);
  });
});

describe('isActiveDownloadLimitError / isTorboxApplicationServerError', () => {
  test('detects active download limit from thrown-shaped errors', () => {
    const err = axiosError({
      status: 500,
      data: {
        error: 'DATABASE_ERROR',
        detail: 'You have reached your active download limit of 3. Please upgrade your plan.',
      },
      message: 'You have reached your active download limit of 3. Please upgrade your plan.',
    });
    err.isActiveDownloadLimit = true;
    expect(isActiveDownloadLimitError(err)).toBe(true);
    expect(
      isTorboxApplicationServerError({
        error: 'DATABASE_ERROR',
        detail: 'You have reached your active download limit of 3.',
      })
    ).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isActiveDownloadLimitError(new Error('Network Error'))).toBe(false);
    expect(isTorboxApplicationServerError({ detail: 'Internal Server Error' })).toBe(false);
  });
});

describe('ApiClient application errors vs connectionErrorFallback', () => {
  test('throws active download limit instead of returning connection fallback', async () => {
    const client = new ApiClient('fake-api-key');
    client.client = {
      post: async () => {
        throw axiosError({
          status: 500,
          data: {
            error: 'DATABASE_ERROR',
            detail:
              'You have reached your active download limit of 3. Please upgrade your plan to add more torrents.',
          },
          message: 'Request failed with status code 500',
        });
      },
    };

    let thrown = null;
    try {
      await client.controlQueuedDownload(123, 'start', 'torrent');
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeTruthy();
    expect(thrown.isTorboxApplicationError).toBe(true);
    expect(thrown.isActiveDownloadLimit).toBe(true);
    expect(thrown.isConnectionError).toBeFalsy();
  });
});

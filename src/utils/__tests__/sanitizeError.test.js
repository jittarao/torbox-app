import { describe, expect, test, afterEach } from 'bun:test';
import {
  extractPublicErrorCode,
  extractPublicErrorDetail,
  httpStatusForPublicError,
  publicApiErrorResponse,
  sanitizeError,
} from '../sanitizeError.js';

describe('sanitizeError', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('returns generic message in production for internal errors', () => {
    process.env.NODE_ENV = 'production';
    expect(sanitizeError(new Error('SQL connection failed at 10.0.0.1'))).toBe(
      'Internal server error'
    );
  });

  test('returns error message in development', () => {
    process.env.NODE_ENV = 'development';
    expect(sanitizeError(new Error('Detailed failure'))).toBe('Detailed failure');
  });

  test('coerces non-Error values', () => {
    process.env.NODE_ENV = 'development';
    expect(sanitizeError('plain string')).toBe('plain string');
  });

  test('passes through known TorBox codes in production', () => {
    process.env.NODE_ENV = 'production';
    expect(sanitizeError(new Error('AUTH_ERROR'))).toBe('AUTH_ERROR');
    expect(sanitizeError(new Error('DATABASE_ERROR'))).toBe('DATABASE_ERROR');
    expect(sanitizeError(new Error('UNKNOWN_ERROR'))).toBe('UNKNOWN_ERROR');
    expect(sanitizeError(new Error('AUTH_ERROR: bad key'))).toBe('AUTH_ERROR');
    expect(sanitizeError(new Error('BOZO_FILE'))).toBe('BOZO_FILE');
  });
});

describe('extractPublicErrorCode / httpStatusForPublicError', () => {
  test('extracts exact and prefixed codes', () => {
    expect(extractPublicErrorCode(new Error('AUTH_ERROR'))).toBe('AUTH_ERROR');
    expect(extractPublicErrorCode(new Error('AUTH_ERROR: detail'))).toBe('AUTH_ERROR');
    expect(extractPublicErrorCode({ error: 'ITEM_NOT_FOUND', detail: 'gone' })).toBe(
      'ITEM_NOT_FOUND'
    );
    expect(extractPublicErrorCode(new Error('SQL boom'))).toBe(null);
  });

  test('extracts TorBox detail from objects and prefixed messages', () => {
    expect(extractPublicErrorDetail({ error: 'AUTH_ERROR', detail: 'try again' })).toBe(
      'try again'
    );
    expect(extractPublicErrorDetail(new Error('DATABASE_ERROR: db busy'))).toBe('db busy');
  });

  test('maps codes using TorBox server-fault rule (*_ERROR → 503)', () => {
    // Server faults (end in ERROR)
    expect(httpStatusForPublicError('AUTH_ERROR')).toBe(503);
    expect(httpStatusForPublicError('DATABASE_ERROR')).toBe(503);
    expect(httpStatusForPublicError('UNKNOWN_ERROR')).toBe(503);
    expect(httpStatusForPublicError('DOWNLOAD_SERVER_ERROR')).toBe(503);
    expect(httpStatusForPublicError('NO_SERVERS_AVAILABLE_ERROR')).toBe(503);

    // Client faults
    expect(httpStatusForPublicError('NO_AUTH')).toBe(401);
    expect(httpStatusForPublicError('BAD_TOKEN')).toBe(401);
    expect(httpStatusForPublicError('ITEM_NOT_FOUND')).toBe(404);
    expect(httpStatusForPublicError('INVALID_OPTION')).toBe(400);
    expect(httpStatusForPublicError('ACTIVE_LIMIT')).toBe(429);
  });

  test('publicApiErrorResponse mirrors TorBox success/error/detail shape', () => {
    process.env.NODE_ENV = 'production';
    const auth = publicApiErrorResponse({
      error: 'AUTH_ERROR',
      detail: 'There was an error verifying your API key.',
    });
    expect(auth.status).toBe(503);
    expect(auth.body).toEqual({
      success: false,
      error: 'AUTH_ERROR',
      detail: 'There was an error verifying your API key.',
    });

    const badToken = publicApiErrorResponse(new Error('BAD_TOKEN'));
    expect(badToken.status).toBe(401);
    expect(badToken.body).toEqual({ success: false, error: 'BAD_TOKEN', detail: null });

    const internal = publicApiErrorResponse(new Error('SQL connection failed'));
    expect(internal.status).toBe(500);
    expect(internal.body).toEqual({
      success: false,
      error: 'Internal server error',
      detail: null,
    });
  });
});

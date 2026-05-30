import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { sanitizeError } from '../sanitizeError.js';

describe('sanitizeError', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('returns generic message in production', () => {
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
});

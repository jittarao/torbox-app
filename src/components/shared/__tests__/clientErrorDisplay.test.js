import { describe, expect, test, afterEach } from 'bun:test';
import { getClientErrorMessage } from '@/components/shared/clientErrorDisplay';

describe('getClientErrorMessage', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('returns raw message in development', () => {
    process.env.NODE_ENV = 'development';
    const error = new Error('Minified React error #185');
    expect(getClientErrorMessage(error, 'fallback')).toBe('Minified React error #185');
  });

  test('hides minified React errors in production', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('Minified React error #185; visit https://react.dev/errors/185');
    expect(getClientErrorMessage(error, 'Something went wrong.')).toBe('Something went wrong.');
  });

  test('allows short actionable messages in production', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('Failed to load downloads.');
    expect(getClientErrorMessage(error, 'fallback')).toBe('Failed to load downloads.');
  });
});

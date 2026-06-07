import { describe, expect, test } from 'bun:test';
import { resolveTorboxApiKeyFromHeaders } from '../resolveTorboxApiKey.js';

describe('resolveTorboxApiKeyFromHeaders', () => {
  test('extracts bearer token before x-api-key', () => {
    const headers = new Headers({
      Authorization: 'Bearer bearer-key',
      'x-api-key': 'header-key',
    });

    expect(resolveTorboxApiKeyFromHeaders(headers)).toBe('bearer-key');
  });

  test('falls back to x-api-key', () => {
    const headers = new Headers({
      'x-api-key': 'header-key',
    });

    expect(resolveTorboxApiKeyFromHeaders(headers)).toBe('header-key');
  });

  test('ignores malformed authorization values', () => {
    const headers = new Headers({
      Authorization: 'Basic abc123',
    });

    expect(resolveTorboxApiKeyFromHeaders(headers)).toBe(null);
  });
});

import { describe, expect, test } from 'bun:test';
import { extractRateLimitHeaders, mergeRateLimitHeaders } from '../forwardRateLimitHeaders.js';

describe('forwardRateLimitHeaders', () => {
  test('extractRateLimitHeaders reads standard rate-limit headers', () => {
    const response = new Response(null, {
      status: 429,
      headers: {
        'Retry-After': '42',
        'RateLimit-Policy': '1000;w=900',
        'RateLimit-Limit': '1000',
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': '120',
      },
    });

    expect(extractRateLimitHeaders(response)).toEqual({
      'retry-after': '42',
      'ratelimit-policy': '1000;w=900',
      'ratelimit-limit': '1000',
      'ratelimit-remaining': '0',
      'ratelimit-reset': '120',
    });
  });

  test('mergeRateLimitHeaders keeps the largest retry delay', () => {
    expect(
      mergeRateLimitHeaders(
        { 'retry-after': '30', 'ratelimit-remaining': '0' },
        { 'retry-after': '90', 'ratelimit-reset': '45' }
      )
    ).toEqual({
      'ratelimit-remaining': '0',
      'retry-after': '90',
      'ratelimit-reset': '45',
    });
  });

  test('mergeRateLimitHeaders returns empty object for no inputs', () => {
    expect(mergeRateLimitHeaders()).toEqual({});
  });
});

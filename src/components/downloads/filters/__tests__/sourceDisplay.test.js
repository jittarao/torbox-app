import { describe, expect, test } from 'bun:test';
import { extractSourceHost, formatSourceLabel } from '../sourceDisplay';

describe('extractSourceHost', () => {
  test('extracts hostname from https URL', () => {
    expect(extractSourceHost('https://pixeldrain.com/api/file/abc')).toBe('pixeldrain.com');
  });

  test('includes non-default port', () => {
    expect(extractSourceHost('http://localhost:8080/path')).toBe('localhost:8080');
  });

  test('keeps subdomains separate', () => {
    expect(extractSourceHost('https://cdn.example.com/file.zip')).toBe('cdn.example.com');
    expect(extractSourceHost('https://example.com/file.zip')).toBe('example.com');
  });

  test('strips www prefix from hostname', () => {
    expect(extractSourceHost('https://www.pixeldrain.com/api/file/abc')).toBe('pixeldrain.com');
    expect(extractSourceHost('https://WWW.example.com/file.zip')).toBe('example.com');
    expect(extractSourceHost('http://www.example.com:8080/path')).toBe('example.com:8080');
  });

  test('returns empty for invalid or missing input', () => {
    expect(extractSourceHost('')).toBe('');
    expect(extractSourceHost(null)).toBe('');
    expect(extractSourceHost('not-a-url')).toBe('');
  });
});

describe('formatSourceLabel', () => {
  test('returns host as-is when short', () => {
    expect(formatSourceLabel('pixeldrain.com')).toBe('pixeldrain.com');
  });

  test('truncates long hosts', () => {
    const long = 'a'.repeat(50);
    expect(formatSourceLabel(long)).toBe(`${'a'.repeat(37)}…`);
  });
});

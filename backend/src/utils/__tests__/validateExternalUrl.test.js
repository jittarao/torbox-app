import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  validateExternalUrl,
  isPrivateOrReservedIp,
  stripIpv6Brackets,
} from '../validateExternalUrl.js';

describe('validateExternalUrl', () => {
  const prevAllowHttp = process.env.STREMIO_ALLOW_HTTP;

  beforeEach(() => {
    delete process.env.STREMIO_ALLOW_HTTP;
  });

  afterEach(() => {
    if (prevAllowHttp === undefined) delete process.env.STREMIO_ALLOW_HTTP;
    else process.env.STREMIO_ALLOW_HTTP = prevAllowHttp;
  });

  test('accepts public https URLs', () => {
    const result = validateExternalUrl('https://addon.example.com/manifest.json');
    expect(result.valid).toBe(true);
  });

  test('rejects http by default', () => {
    expect(validateExternalUrl('http://addon.example.com/manifest.json').valid).toBe(false);
    expect(validateExternalUrl('http://addon.example.com/manifest.json').reason).toMatch(/HTTPS/i);
  });

  test('allows http when STREMIO_ALLOW_HTTP is set', () => {
    process.env.STREMIO_ALLOW_HTTP = 'true';
    expect(validateExternalUrl('http://addon.example.com/manifest.json').valid).toBe(true);
  });

  test('rejects non-http protocols', () => {
    expect(validateExternalUrl('ftp://example.com/x').valid).toBe(false);
    expect(validateExternalUrl('file:///etc/passwd').valid).toBe(false);
  });

  test('rejects localhost and private IPs', () => {
    expect(validateExternalUrl('https://localhost/manifest.json').valid).toBe(false);
    expect(validateExternalUrl('https://127.0.0.1/manifest.json').valid).toBe(false);
    expect(validateExternalUrl('https://192.168.1.1/manifest.json').valid).toBe(false);
    expect(validateExternalUrl('https://10.0.0.1/manifest.json').valid).toBe(false);
    expect(validateExternalUrl('https://169.254.169.254/latest').valid).toBe(false);
  });

  test('rejects IPv6 loopback and IPv4-mapped private forms', () => {
    expect(validateExternalUrl('https://[::1]/').valid).toBe(false);
    expect(validateExternalUrl('https://[::ffff:127.0.0.1]/').valid).toBe(false);
    expect(validateExternalUrl('https://[::ffff:7f00:1]/').valid).toBe(false);
    expect(validateExternalUrl('https://[::ffff:a9fe:a9fe]/').valid).toBe(false);
    expect(validateExternalUrl('https://[::ffff:c0a8:0101]/').valid).toBe(false);
  });

  test('rejects URLs with credentials', () => {
    expect(validateExternalUrl('https://user:pass@example.com/x').valid).toBe(false);
  });

  test('isPrivateOrReservedIp covers common ranges', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('[::1]')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:7f00:1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:a9fe:a9fe')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:808:808')).toBe(false); // 8.8.8.8
    expect(isPrivateOrReservedIp('not-an-ip')).toBe(false);
  });

  test('stripIpv6Brackets', () => {
    expect(stripIpv6Brackets('[::1]')).toBe('::1');
    expect(stripIpv6Brackets('example.com')).toBe('example.com');
  });

  test('fail-closed on unparseable IPv6', () => {
    expect(isPrivateOrReservedIp('1:2:3:4:5:6:7')).toBe(true);
    expect(isPrivateOrReservedIp('gggg::1')).toBe(true);
  });
});

import { describe, expect, test, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { DownloadProtectionService, DownloadProtectedError } from '../DownloadProtectionService.js';
import { up } from '../../database/migrations/user/020_protected_downloads_schema.js';

describe('DownloadProtectionService', () => {
  /** @type {import('bun:sqlite').Database} */
  let db;
  /** @type {DownloadProtectionService} */
  let service;

  beforeEach(() => {
    db = new Database(':memory:');
    up(db);
    service = new DownloadProtectionService(db);
  });

  test('setProtected and isProtected', () => {
    expect(service.isProtected('1')).toBe(false);
    service.setProtected(['1', '2'], true);
    expect(service.isProtected('1')).toBe(true);
    expect(service.isProtected('2')).toBe(true);
    service.setProtected(['1'], false);
    expect(service.isProtected('1')).toBe(false);
    expect(service.isProtected('2')).toBe(true);
  });

  test('partitionByProtection splits allowed and blocked ids', () => {
    service.setProtected(['blocked'], true);
    const result = service.partitionByProtection(['allowed', 'blocked', 'allowed']);
    expect(result.allowed).toEqual(['allowed']);
    expect(result.blocked).toEqual(['blocked']);
  });

  test('assertDestructiveAllowed throws for protected downloads', () => {
    service.setProtected(['9'], true);
    expect(() => service.assertDestructiveAllowed('delete', ['9'])).toThrow(DownloadProtectedError);
    expect(() => service.assertDestructiveAllowed('archive', ['9'])).toThrow(
      DownloadProtectedError
    );
  });

  test('assertDestructiveAllowed ignores unknown operations', () => {
    service.setProtected(['9'], true);
    expect(() => service.assertDestructiveAllowed('rename', ['9'])).not.toThrow();
  });

  test('getProtectedIds returns protected download ids', () => {
    service.setProtected(['42'], true);
    expect(service.getProtectedIds()).toEqual(['42']);
  });
});

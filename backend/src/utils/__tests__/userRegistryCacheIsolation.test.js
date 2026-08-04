import { describe, it, expect, beforeEach } from 'bun:test';
import cache from '../cache.js';

/**
 * Regression: path-only registry rows must not share the full userRegistry cache.
 * Poisoning caused runActionBatch to see missing encrypted_key after every poll.
 */
describe('user registry cache isolation', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('setUserDbPath does not write into userRegistryCache', () => {
    cache.setUserDbPath('user-a', '/data/users/user_a.sqlite');
    expect(cache.getUserDbPath('user-a')).toBe('/data/users/user_a.sqlite');
    expect(cache.getUserRegistry('user-a')).toBeUndefined();
  });

  it('setUserRegistry warms the db path cache', () => {
    cache.setUserRegistry('user-b', {
      auth_id: 'user-b',
      db_path: '/data/users/user_b.sqlite',
      encrypted_key: 'enc',
      key_name: 'default',
    });
    expect(cache.getUserDbPath('user-b')).toBe('/data/users/user_b.sqlite');
    expect(cache.getUserRegistry('user-b')?.encrypted_key).toBe('enc');
  });

  it('invalidateUserRegistry clears both full and path caches', () => {
    cache.setUserRegistry('user-c', {
      db_path: '/data/users/user_c.sqlite',
      encrypted_key: 'enc',
    });
    cache.invalidateUserRegistry('user-c');
    expect(cache.getUserRegistry('user-c')).toBeUndefined();
    expect(cache.getUserDbPath('user-c')).toBeUndefined();
  });

  it('path-only poison entry is detectable via missing encrypted_key property', () => {
    // Simulate legacy/buggy writer that stored SELECT db_path into userRegistryCache
    cache.setUserRegistry('user-d', { db_path: '/data/users/user_d.sqlite' });
    const cached = cache.getUserRegistry('user-d');
    expect(cached).toEqual({ db_path: '/data/users/user_d.sqlite' });
    expect(Object.prototype.hasOwnProperty.call(cached, 'encrypted_key')).toBe(false);
  });
});

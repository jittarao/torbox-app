import { describe, it, expect, beforeEach } from 'bun:test';
import PollingScheduler from '../PollingScheduler.js';

describe('PollingScheduler.invalidateCachedEngine', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new PollingScheduler(
      { getUserDatabase: async () => ({ db: {} }) },
      { getUserRegistryInfo: () => null },
      null
    );
    scheduler.cachedEngines.set('user1', {
      isInitialized: true,
      shutdown: () => {},
      invalidateRuleCache: () => {},
    });
  });

  it('removes cached engine for authId', () => {
    expect(scheduler.cachedEngines.has('user1')).toBe(true);
    scheduler.invalidateCachedEngine('user1');
    expect(scheduler.cachedEngines.has('user1')).toBe(false);
  });

  it('no-ops for empty authId', () => {
    scheduler.cachedEngines.set('user2', { isInitialized: true, shutdown: () => {} });
    scheduler.invalidateCachedEngine('');
    expect(scheduler.cachedEngines.has('user2')).toBe(true);
  });
});

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import cache from '../../utils/cache.js';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
} from '../../routes/__tests__/helpers/backendTestHelper.js';

/**
 * Reproduces the prod restart failure mode:
 * poll succeeds → isAutomationRuleEnabled opens user DB (path lookup) →
 * runActionBatch reads getUserRegistryInfo and must still see encrypted_key.
 */
describe('getUserRegistryInfo vs path-only lookup', () => {
  let env;
  let authId;

  beforeEach(async () => {
    env = await createBackendTestEnv();
    cache.clear();
    const registered = await env.masterDatabase.registerApiKey(
      'tb-cache-poison-test-key-0123456789abcdef012345',
      'cache-poison'
    );
    authId = registered.authId;
  });

  afterEach(() => {
    cleanupBackendTestEnv(env);
  });

  test('path-only resolve does not strip encrypted_key from getUserRegistryInfo', async () => {
    // Simulate post-poll cache invalidation (updateNextPollAt)
    cache.invalidateUserRegistry(authId);

    // Simulate isAutomationRuleEnabled → getUserDatabase → _resolveUserRegistry
    const pathRow = env.userDatabaseManager._resolveUserRegistry(authId);
    expect(pathRow?.db_path).toBeTruthy();
    // Must not have poisoned the full registry cache
    const maybePoisoned = cache.getUserRegistry(authId);
    expect(
      maybePoisoned === undefined ||
        Object.prototype.hasOwnProperty.call(maybePoisoned, 'encrypted_key')
    ).toBe(true);

    const info = env.masterDatabase.getUserRegistryInfo(authId);
    expect(info?.encrypted_key).toBeTruthy();
  });

  test('rejects legacy path-only poison entries and re-queries', async () => {
    const user = env.masterDatabase.getUserRegistryInfo(authId);
    expect(user?.encrypted_key).toBeTruthy();

    // Force-poison like the old _resolveUserRegistry did
    cache.setUserRegistry(authId, { db_path: user.db_path });

    const recovered = env.masterDatabase.getUserRegistryInfo(authId);
    expect(recovered?.encrypted_key).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(recovered, 'encrypted_key')).toBe(true);
  });
});

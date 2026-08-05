import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import PollingScheduler from '../PollingScheduler.js';
import torboxApiOutageCoordinator from '../../api/TorboxApiOutageCoordinator.js';

describe('PollingScheduler scheduled auth deactivation', () => {
  let scheduler;
  let authFailures;
  let userStatus;
  let handleAuthCalls;
  let prevThreshold;

  beforeEach(() => {
    torboxApiOutageCoordinator.resetForTests();
    prevThreshold = process.env.AUTH_FAILURE_DEACTIVATE_AFTER;
    process.env.AUTH_FAILURE_DEACTIVATE_AFTER = '3';
    authFailures = 0;
    userStatus = 'active';
    handleAuthCalls = 0;

    const masterDb = {
      getUsersDueForPolling: () => [
        {
          auth_id: 'dead-key-user',
          encrypted_key: 'enc',
          has_active_rules: 1,
        },
      ],
      countDueUsersSkippedForInactivity: () => 0,
      updateNextPollAtBatch: () => {},
      updateNextPollAt: () => {},
      getUserRegistryInfo: () => ({
        auth_id: 'dead-key-user',
        encrypted_key: 'enc',
      }),
      incrementConsecutiveAuthFailures: () => {
        authFailures += 1;
        return authFailures;
      },
      getConsecutiveAuthFailures: () => authFailures,
      updateUserStatus: (authId, status) => {
        expect(authId).toBe('dead-key-user');
        userStatus = status;
      },
      resetConsecutiveAuthFailures: () => {
        authFailures = 0;
      },
    };

    scheduler = new PollingScheduler({ getUserDatabase: async () => ({ db: {} }) }, masterDb, null);
    scheduler.isRunning = true;
    scheduler.pollSemaphore = { acquire: async () => {}, release: () => {} };
    scheduler.processSemaphore = { acquire: async () => {}, release: () => {} };

    const authError = Object.assign(new Error('Invalid or expired API key'), {
      name: 'AuthenticationError',
      isAuthError: true,
      status: 403,
    });

    scheduler.fetchTorrentsForUser = async (user) => ({
      user,
      poller: {
        authId: user.auth_id,
        masterDb,
        async handleAuthenticationError(error) {
          handleAuthCalls += 1;
          // Mirror UserPoller.handleAuthenticationError side effects
          authFailures = masterDb.incrementConsecutiveAuthFailures(user.auth_id);
          const threshold = Math.max(
            1,
            parseInt(process.env.AUTH_FAILURE_DEACTIVATE_AFTER || '3', 10)
          );
          if (authFailures >= threshold) {
            masterDb.updateUserStatus(user.auth_id, 'inactive');
          }
          const authErr = new Error(`API authentication failed: ${error.message}`);
          authErr.name = 'AuthenticationError';
          authErr.isAuthError = true;
          throw authErr;
        },
      },
      error: authError,
    });
  });

  afterEach(() => {
    if (prevThreshold === undefined) {
      delete process.env.AUTH_FAILURE_DEACTIVATE_AFTER;
    } else {
      process.env.AUTH_FAILURE_DEACTIVATE_AFTER = prevThreshold;
    }
  });

  it('records auth failures on the scheduled poll path', async () => {
    await scheduler.pollDueUsers();

    expect(handleAuthCalls).toBe(1);
    expect(authFailures).toBe(1);
    expect(userStatus).toBe('active');
  });

  it('deactivates the user after AUTH_FAILURE_DEACTIVATE_AFTER consecutive failures', async () => {
    await scheduler.pollDueUsers();
    await scheduler.pollDueUsers();
    await scheduler.pollDueUsers();

    expect(handleAuthCalls).toBe(3);
    expect(authFailures).toBe(3);
    expect(userStatus).toBe('inactive');
  });
});

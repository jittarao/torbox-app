import { describe, it, expect, beforeEach, mock } from 'bun:test';
import PollingScheduler from '../PollingScheduler.js';
import DatabaseRetryHelper from '../helpers/DatabaseRetryHelper.js';

describe('PollingScheduler processUserPoll pin release', () => {
  let scheduler;
  let closeConnection;
  let markInactive;
  let updateNextPollAt;

  beforeEach(() => {
    closeConnection = mock(() => true);
    markInactive = mock(() => {});
    updateNextPollAt = mock(() => {});

    scheduler = new PollingScheduler(
      {
        getUserDatabase: async () => ({ db: {} }),
        closeConnection,
        markInactive,
      },
      {
        getUserRegistryInfo: () => null,
        updateNextPollAt,
        resetConsecutiveAuthFailures: () => {},
      },
      null
    );
    scheduler.pollKickoutMs = 5000;
  });

  it('releases durable DB pin in finally after processFetchedTorrents', async () => {
    const authId = 'pin-leak-user';
    const releaseDbPin = mock(() => {});
    const poller = {
      authId,
      userDatabaseManager: scheduler.userDatabaseManager,
      automationEngine: null,
      dbManager: { db: {} },
      _dbPinned: true,
      _releaseDbPin: releaseDbPin,
      processFetchedTorrents: async () => ({
        success: true,
        changes: { new: [], updated: [], removed: [], stateTransitions: [] },
        ruleResults: { pendingActions: [] },
        nextPollAt: new Date(Date.now() + 60000),
        nonTerminalCount: 0,
      }),
      lastPollAt: null,
    };

    scheduler.pollers.set(authId, poller);
    scheduler.cachedEngines.set(authId, {
      isInitialized: true,
      hasActiveRules: async () => true,
      shutdown: () => {},
    });

    // Avoid full handleSuccessfulPoll master-db side effects
    scheduler.handleSuccessfulPoll = async () => {};

    const counters = { success: 0, skipped: 0, error: 0 };
    await scheduler.processUserPoll(
      { auth_id: authId, encrypted_key: 'enc' },
      poller,
      [],
      counters,
      { callerHoldsPipelineMutex: true }
    );

    expect(releaseDbPin).toHaveBeenCalled();
    expect(closeConnection).toHaveBeenCalledWith(authId);
    expect(poller.dbManager).toBeNull();
    expect(counters.success).toBe(1);
  });

  it('still releases pin when processFetchedTorrents throws', async () => {
    const authId = 'pin-leak-error-user';
    const releaseDbPin = mock(() => {});
    const poller = {
      authId,
      userDatabaseManager: scheduler.userDatabaseManager,
      automationEngine: null,
      dbManager: { db: {} },
      _dbPinned: true,
      _releaseDbPin: releaseDbPin,
      processFetchedTorrents: async () => {
        throw new Error('boom');
      },
    };

    scheduler.pollers.set(authId, poller);
    scheduler.cachedEngines.set(authId, {
      isInitialized: true,
      hasActiveRules: async () => true,
      shutdown: () => {},
    });

    const counters = { success: 0, skipped: 0, error: 0 };
    await scheduler.processUserPoll(
      { auth_id: authId, encrypted_key: 'enc' },
      poller,
      [],
      counters,
      { callerHoldsPipelineMutex: true }
    );

    expect(releaseDbPin).toHaveBeenCalled();
    expect(closeConnection).toHaveBeenCalledWith(authId);
    expect(counters.error).toBe(1);
  });

  it('retries pool exhaustion sooner than generic errors', () => {
    const authId = 'pool-user';
    scheduler.handlePollError(authId, new Error('Database pool exhausted (50/50)'), 0.01);
    expect(updateNextPollAt).toHaveBeenCalled();
    const nextAt = updateNextPollAt.mock.calls[0][1];
    const deltaMs = nextAt.getTime() - Date.now();
    expect(deltaMs).toBeGreaterThan(60_000);
    expect(deltaMs).toBeLessThan(3 * 60_000);
  });

  it('releases durable DB pin in manual triggerPoll finally', async () => {
    const authId = 'manual-pin-user';
    const releaseDbPin = mock(() => {});
    const poller = {
      authId,
      userDatabaseManager: scheduler.userDatabaseManager,
      automationEngine: null,
      dbManager: { db: {} },
      _dbPinned: true,
      _releaseDbPin: releaseDbPin,
      poll: async () => ({
        success: true,
        skipped: false,
        ruleResults: { evaluated: 0, executed: 0 },
      }),
    };

    scheduler.pollers.set(authId, poller);
    scheduler.getOrCreatePoller = async () => poller;
    scheduler.createEngineForPoll = async () => ({
      isInitialized: true,
      hasActiveRules: async () => true,
      shutdown: () => {},
    });
    scheduler.masterDb.getUserRegistryInfo = () => ({
      encrypted_key: 'enc',
      has_active_rules: 1,
      last_seen_at: null,
    });

    await scheduler.triggerPoll(authId);

    expect(releaseDbPin).toHaveBeenCalled();
    expect(closeConnection).toHaveBeenCalledWith(authId);
    expect(poller.dbManager).toBeNull();
  });
});

describe('DatabaseRetryHelper.isTransientError', () => {
  it('does not treat pool exhaustion as transient', () => {
    expect(DatabaseRetryHelper.isTransientError(new Error('Database pool exhausted (50/50)'))).toBe(
      false
    );
  });

  it('treats SQLITE_BUSY as transient', () => {
    expect(DatabaseRetryHelper.isTransientError(new Error('SQLITE_BUSY'))).toBe(true);
  });

  it('treats closed database as transient', () => {
    expect(DatabaseRetryHelper.isTransientError(new Error('Cannot use a closed database'))).toBe(
      true
    );
  });
});

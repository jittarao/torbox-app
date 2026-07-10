import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import PollingScheduler from '../PollingScheduler.js';
import torboxApiOutageCoordinator from '../../api/TorboxApiOutageCoordinator.js';

const ENV_KEY = 'AUTOMATION_INACTIVE_USER_DAYS';

describe('PollingScheduler inactivity gating', () => {
  let scheduler;
  let savedEnv;

  beforeEach(() => {
    savedEnv = process.env[ENV_KEY];
    process.env[ENV_KEY] = '30';
    torboxApiOutageCoordinator.resetForTests();

    scheduler = new PollingScheduler({ getUserDatabase: async () => ({ db: {} }) }, {}, null);
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = savedEnv;
    }
  });

  it('triggerPoll returns user_inactive when last_seen_at is stale', async () => {
    scheduler.masterDb = {
      getUserRegistryInfo: () => ({
        auth_id: 'inactive-user',
        encrypted_key: 'enc',
        last_seen_at: '2026-06-01 00:00:00',
      }),
      touchUserActivityBatch: () => {},
    };

    const result = await scheduler.triggerPoll('inactive-user');

    expect(result).toEqual({
      success: false,
      skipped: true,
      reason: 'user_inactive',
    });
    expect(scheduler.getStatus().inactivityFilter.totalSkippedManual).toBe(1);
  });

  it('triggerPoll fast-persists activity and proceeds for returning users', async () => {
    let lastSeenAt = '2026-06-01 00:00:00';
    scheduler.masterDb = {
      getUserRegistryInfo: () => ({
        auth_id: 'returning-user',
        encrypted_key: 'enc',
        last_seen_at: lastSeenAt,
      }),
      touchUserActivityBatch: (entries) => {
        lastSeenAt = '2026-07-10 12:00:00';
        for (const { authId } of entries) {
          scheduler.masterDb.getUserRegistryInfo = () => ({
            auth_id: authId,
            encrypted_key: 'enc',
            last_seen_at: lastSeenAt,
          });
        }
      },
    };

    scheduler.getOrCreatePoller = async () => ({
      automationEngine: null,
      poll: async () => ({ success: true }),
    });
    scheduler.createEngineForPoll = async () => ({});
    scheduler.getPipelineMutex = () => ({
      acquire: async () => {},
      release: () => {},
      isEmpty: () => true,
    });

    const result = await scheduler.triggerPoll('returning-user');

    expect(result.success).toBe(true);
  });

  it('pollDueUsers populates inactivityFilter cycle stats and cumulative counters', async () => {
    scheduler.masterDb = {
      getUsersDueForPolling: () => [{ auth_id: 'active-user', has_active_rules: 1 }],
      countDueUsersSkippedForInactivity: () => 2,
      updateNextPollAtBatch: () => {},
    };
    scheduler.isRunning = true;
    scheduler.pollSemaphore = { acquire: async () => {}, release: () => {} };
    scheduler.processSemaphore = { acquire: async () => {}, release: () => {} };
    scheduler.fetchTorrentsForUser = async () => ({
      error: { message: 'skip processing in test' },
      user: { auth_id: 'active-user' },
    });
    scheduler.getPipelineMutex = () => ({
      acquire: async () => {},
      release: () => {},
      isEmpty: () => true,
    });
    scheduler.handlePollError = () => {};

    await scheduler.pollDueUsers();

    const status = scheduler.getStatus();
    expect(status.inactivityFilter).toMatchObject({
      enabled: true,
      inactiveUserDays: 30,
      lastCycleEligible: 1,
      lastCycleSkippedInactive: 2,
      totalSkippedScheduled: 2,
      totalSkippedManual: 0,
      totalSkippedQueue: 0,
    });
  });

  it('getStatus exposes inactivityFilter shape before any poll cycle', () => {
    const status = scheduler.getStatus();

    expect(status.inactivityFilter).toEqual({
      enabled: true,
      inactiveUserDays: 30,
      lastCycleEligible: 0,
      lastCycleSkippedInactive: 0,
      totalSkippedScheduled: 0,
      totalSkippedManual: 0,
      totalSkippedQueue: 0,
    });
  });
});

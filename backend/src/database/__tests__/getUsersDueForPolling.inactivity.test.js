import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { formatSqliteUtc } from '../../utils/sqliteDatetime.js';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
} from '../../routes/__tests__/helpers/backendTestHelper.js';

const REFERENCE_MS = Date.parse('2026-07-10T12:00:00.000Z');
const CUTOFF_30D = formatSqliteUtc(new Date(REFERENCE_MS - 30 * 24 * 60 * 60 * 1000));

async function insertPollReadyUser(masterDatabase, apiKey, { lastSeenAt = null } = {}) {
  const { authId } = await masterDatabase.registerApiKey(apiKey, 'poll-test');
  masterDatabase.runQuery(
    `
    UPDATE user_registry
    SET has_active_rules = 1,
        next_poll_at = '2020-01-01 00:00:00',
        last_seen_at = ?
    WHERE auth_id = ?
  `,
    [lastSeenAt, authId]
  );
  return authId;
}

function authIdsFromDueUsers(users) {
  return users.map((u) => u.auth_id).sort();
}

describe('getUsersDueForPolling inactivity filter', () => {
  let env;

  beforeEach(async () => {
    env = await createBackendTestEnv();
  });

  afterEach(() => {
    cleanupBackendTestEnv(env);
  });

  test('includes active user within window', async () => {
    const activeId = await insertPollReadyUser(
      env.masterDatabase,
      'tb-active-user-key-0123456789abcdef0123456789ab',
      { lastSeenAt: '2026-07-01 00:00:00' }
    );
    const due = env.masterDatabase.getUsersDueForPolling({ inactivityCutoff: CUTOFF_30D });
    expect(authIdsFromDueUsers(due)).toContain(activeId);
  });

  test('excludes inactive user before cutoff', async () => {
    const inactiveId = await insertPollReadyUser(
      env.masterDatabase,
      'tb-inactive-user-key-0123456789abcdef012345678',
      { lastSeenAt: '2026-06-01 00:00:00' }
    );
    const due = env.masterDatabase.getUsersDueForPolling({ inactivityCutoff: CUTOFF_30D });
    expect(authIdsFromDueUsers(due)).not.toContain(inactiveId);
    expect(env.masterDatabase.countDueUsersSkippedForInactivity(CUTOFF_30D)).toBe(1);
  });

  test('includes user exactly on cutoff', async () => {
    const cutoffId = await insertPollReadyUser(
      env.masterDatabase,
      'tb-cutoff-user-key-0123456789abcdef0123456789abc',
      { lastSeenAt: CUTOFF_30D }
    );
    const due = env.masterDatabase.getUsersDueForPolling({ inactivityCutoff: CUTOFF_30D });
    expect(authIdsFromDueUsers(due)).toContain(cutoffId);
  });

  test('includes NULL last_seen_at for backward compatibility', async () => {
    const nullId = await insertPollReadyUser(
      env.masterDatabase,
      'tb-null-seen-user-key-0123456789abcdef0123456789',
      { lastSeenAt: null }
    );
    const due = env.masterDatabase.getUsersDueForPolling({ inactivityCutoff: CUTOFF_30D });
    expect(authIdsFromDueUsers(due)).toContain(nullId);
  });

  test('disabled filter returns inactive user', async () => {
    const inactiveId = await insertPollReadyUser(
      env.masterDatabase,
      'tb-inactive-user-key-0123456789abcdef012345678',
      { lastSeenAt: '2026-06-01 00:00:00' }
    );
    const due = env.masterDatabase.getUsersDueForPolling({ inactivityCutoff: null });
    expect(authIdsFromDueUsers(due)).toContain(inactiveId);
    expect(env.masterDatabase.countDueUsersSkippedForInactivity(null)).toBe(0);
  });

  test('user becomes active again after last_seen_at update', async () => {
    const inactiveId = await insertPollReadyUser(
      env.masterDatabase,
      'tb-inactive-user-key-0123456789abcdef012345678',
      { lastSeenAt: '2026-06-01 00:00:00' }
    );
    let due = env.masterDatabase.getUsersDueForPolling({ inactivityCutoff: CUTOFF_30D });
    expect(authIdsFromDueUsers(due)).not.toContain(inactiveId);

    env.masterDatabase.touchUserActivityBatch([
      { authId: inactiveId, at: new Date('2026-07-10 11:00:00Z') },
    ]);

    due = env.masterDatabase.getUsersDueForPolling({ inactivityCutoff: CUTOFF_30D });
    expect(authIdsFromDueUsers(due)).toContain(inactiveId);
  });
});

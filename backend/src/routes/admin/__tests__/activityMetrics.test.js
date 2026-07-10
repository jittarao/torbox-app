import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  buildActivityFilterClause,
  formatSqliteUtc,
  queryActivityMetrics,
  startOfUtcDay,
} from '../activityMetrics.js';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
} from '../../__tests__/helpers/backendTestHelper.js';

function insertActivityUser(masterDatabase, authId, fields) {
  masterDatabase.runQuery(
    `
    INSERT INTO user_registry (auth_id, db_path, last_seen_at, prev_last_seen_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
    [
      authId,
      `/data/users/${authId}.db`,
      fields.lastSeenAt ?? null,
      fields.prevLastSeenAt ?? null,
      fields.createdAt ?? fields.lastSeenAt ?? '2026-01-01 00:00:00',
    ]
  );
}

describe('activityMetrics helpers', () => {
  test('formatSqliteUtc produces index-friendly datetime', () => {
    const formatted = formatSqliteUtc(new Date('2026-07-10T15:30:45.123Z'));
    expect(formatted).toBe('2026-07-10 15:30:45');
  });

  test('buildActivityFilterClause returns empty for unknown filter', () => {
    const result = buildActivityFilterClause('bogus', null);
    expect(result.clause).toBeNull();
    expect(result.emptyResult).toBeUndefined();
  });

  test('buildActivityFilterClause handles online with no users', () => {
    const tracker = { getOnlineAuthIds: () => [] };
    const result = buildActivityFilterClause('online', tracker);
    expect(result.emptyResult).toBe(true);
  });

  test('buildActivityFilterClause handles online with users', () => {
    const tracker = { getOnlineAuthIds: () => ['abc', 'def'] };
    const result = buildActivityFilterClause('online', tracker);
    expect(result.clause).toContain('ur.auth_id IN');
    expect(result.params).toEqual(['abc', 'def']);
  });

  test('buildActivityFilterClause builds inactive30d clause', () => {
    const result = buildActivityFilterClause('inactive30d', null);
    expect(result.clause).toBe('(ur.last_seen_at IS NULL OR ur.last_seen_at < ?)');
    expect(result.params).toHaveLength(1);
  });

  test('buildActivityFilterClause builds dormant clause with 90-day cutoff', () => {
    const inactive = buildActivityFilterClause('inactive30d', null);
    const dormant = buildActivityFilterClause('dormant', null);
    expect(dormant.clause).toBe(inactive.clause);
    expect(dormant.params[0]).not.toBe(inactive.params[0]);

    const inactiveDate = new Date(String(inactive.params[0]).replace(' ', 'T') + 'Z');
    const dormantDate = new Date(String(dormant.params[0]).replace(' ', 'T') + 'Z');
    const diffDays = (inactiveDate.getTime() - dormantDate.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(60, 0);
  });

  test('buildActivityFilterClause chunks large online sets', () => {
    const onlineIds = Array.from({ length: 600 }, (_, i) => `user-${i}`);
    const tracker = { getOnlineAuthIds: () => onlineIds };
    const result = buildActivityFilterClause('online', tracker);
    expect(result.clause).toContain(' OR ');
    expect(result.params).toHaveLength(600);
  });

  test('startOfUtcDay returns midnight UTC', () => {
    const day = startOfUtcDay(new Date('2026-07-10T18:22:00Z'));
    expect(day.toISOString()).toBe('2026-07-10T00:00:00.000Z');
  });
});

describe('queryActivityMetrics', () => {
  let env;
  const now = new Date('2026-07-10T12:00:00Z');

  beforeEach(async () => {
    env = await createBackendTestEnv();
    env.masterDatabase.runQuery(
      'UPDATE user_registry SET created_at = ?, last_seen_at = NULL WHERE auth_id = ?',
      ['2026-01-01 00:00:00', env.authId]
    );
    insertActivityUser(env.masterDatabase, 'user-today', {
      lastSeenAt: '2026-07-10 10:00:00',
      createdAt: '2026-06-01 00:00:00',
    });
    insertActivityUser(env.masterDatabase, 'user-yesterday', {
      lastSeenAt: '2026-07-09 10:00:00',
      createdAt: '2026-06-01 00:00:00',
    });
    insertActivityUser(env.masterDatabase, 'user-week', {
      lastSeenAt: '2026-07-05 10:00:00',
      createdAt: '2026-06-01 00:00:00',
    });
    insertActivityUser(env.masterDatabase, 'user-month', {
      lastSeenAt: '2026-06-15 10:00:00',
      createdAt: '2026-06-01 00:00:00',
    });
    insertActivityUser(env.masterDatabase, 'user-older', {
      lastSeenAt: '2026-05-01 10:00:00',
      createdAt: '2026-05-01 00:00:00',
    });
    insertActivityUser(env.masterDatabase, 'user-never', {
      lastSeenAt: null,
      createdAt: '2026-04-01 00:00:00',
    });
    insertActivityUser(env.masterDatabase, 'user-returning', {
      lastSeenAt: '2026-07-10 08:00:00',
      prevLastSeenAt: '2026-05-01 10:00:00',
      createdAt: '2026-03-01 00:00:00',
    });
    insertActivityUser(env.masterDatabase, 'user-new-today', {
      lastSeenAt: '2026-07-10 11:00:00',
      createdAt: '2026-07-10 09:00:00',
    });
  });

  afterEach(() => {
    cleanupBackendTestEnv(env);
  });

  test('aggregates activity buckets from seeded user_registry rows', () => {
    const metrics = queryActivityMetrics(env.masterDatabase, 3, now);

    expect(metrics.online).toBe(3);
    expect(metrics.distribution.today).toBe(3);
    expect(metrics.distribution.yesterday).toBe(1);
    expect(metrics.distribution.last7d).toBe(1);
    expect(metrics.distribution.last30d).toBe(1);
    expect(metrics.distribution.older).toBe(1);
    expect(metrics.distribution.never).toBe(2);
    expect(metrics.returningToday).toBe(1);
    expect(metrics.newToday).toBe(1);
    expect(metrics.last24h).toBeGreaterThanOrEqual(3);
    expect(metrics.allTime).toBeGreaterThanOrEqual(7);
  });
});

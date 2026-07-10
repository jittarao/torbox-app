import { formatSqliteUtc } from '../../utils/sqliteDatetime.js';

export { formatSqliteUtc };

/**
 * SQL helpers for admin user-activity metrics.
 * Uses indexed comparisons on user_registry.last_seen_at and created_at.
 */

/**
 * Start of UTC calendar day for the given date.
 * @param {Date} d
 * @returns {Date}
 */
export function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * @param {import('../../database/Database.js').default} masterDatabase
 * @param {number} onlineCount - from in-memory ActivityTracker
 * @param {Date} [now] - reference time (for tests)
 */
export function queryActivityMetrics(masterDatabase, onlineCount, now = new Date()) {
  const startToday = formatSqliteUtc(startOfUtcDay(now));
  const startYesterday = formatSqliteUtc(
    new Date(startOfUtcDay(now).getTime() - 24 * 60 * 60 * 1000)
  );

  const cutoffs = {
    last24h: formatSqliteUtc(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    last7d: formatSqliteUtc(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
    last30d: formatSqliteUtc(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    last90d: formatSqliteUtc(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)),
    inactive30d: formatSqliteUtc(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    inactive90d: formatSqliteUtc(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)),
    inactive180d: formatSqliteUtc(new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)),
    prev30d: formatSqliteUtc(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    start7dExclusive: formatSqliteUtc(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
    start30dExclusive: formatSqliteUtc(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
  };

  const activityRow =
    masterDatabase.getQuery(
      `
    SELECT
      SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS last24h,
      SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS last7d,
      SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS last30d,
      SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS last90d,
      SUM(CASE WHEN last_seen_at IS NOT NULL THEN 1 ELSE 0 END) AS all_time,
      SUM(CASE WHEN last_seen_at IS NULL OR last_seen_at < ? THEN 1 ELSE 0 END) AS inactive30d,
      SUM(CASE WHEN last_seen_at IS NULL OR last_seen_at < ? THEN 1 ELSE 0 END) AS inactive90d,
      SUM(CASE WHEN last_seen_at IS NULL OR last_seen_at < ? THEN 1 ELSE 0 END) AS inactive180d,
      SUM(CASE WHEN last_seen_at >= ? AND prev_last_seen_at IS NOT NULL AND prev_last_seen_at < ? THEN 1 ELSE 0 END) AS returning_today,
      SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS dist_today,
      SUM(CASE WHEN last_seen_at >= ? AND last_seen_at < ? THEN 1 ELSE 0 END) AS dist_yesterday,
      SUM(CASE WHEN last_seen_at >= ? AND last_seen_at < ? THEN 1 ELSE 0 END) AS dist_last7d,
      SUM(CASE WHEN last_seen_at >= ? AND last_seen_at < ? THEN 1 ELSE 0 END) AS dist_last30d,
      SUM(CASE WHEN last_seen_at IS NOT NULL AND last_seen_at < ? THEN 1 ELSE 0 END) AS dist_older,
      SUM(CASE WHEN last_seen_at IS NULL THEN 1 ELSE 0 END) AS dist_never
    FROM user_registry
  `,
      [
        cutoffs.last24h,
        cutoffs.last7d,
        cutoffs.last30d,
        cutoffs.last90d,
        cutoffs.inactive30d,
        cutoffs.inactive90d,
        cutoffs.inactive180d,
        startToday,
        cutoffs.prev30d,
        startToday,
        startYesterday,
        startToday,
        cutoffs.start7dExclusive,
        startYesterday,
        cutoffs.start30dExclusive,
        cutoffs.start7dExclusive,
        cutoffs.start30dExclusive,
      ]
    ) || {};

  const growthRow =
    masterDatabase.getQuery(
      `
    SELECT
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_today,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_7d,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_30d
    FROM user_registry
  `,
      [startToday, cutoffs.last7d, cutoffs.last30d]
    ) || {};

  return {
    online: onlineCount,
    last24h: activityRow.last24h || 0,
    last7d: activityRow.last7d || 0,
    last30d: activityRow.last30d || 0,
    last90d: activityRow.last90d || 0,
    allTime: activityRow.all_time || 0,
    inactive30d: activityRow.inactive30d || 0,
    inactive90d: activityRow.inactive90d || 0,
    inactive180d: activityRow.inactive180d || 0,
    newToday: growthRow.new_today || 0,
    new7d: growthRow.new_7d || 0,
    new30d: growthRow.new_30d || 0,
    returningToday: activityRow.returning_today || 0,
    distribution: {
      today: activityRow.dist_today || 0,
      yesterday: activityRow.dist_yesterday || 0,
      last7d: activityRow.dist_last7d || 0,
      last30d: activityRow.dist_last30d || 0,
      older: activityRow.dist_older || 0,
      never: activityRow.dist_never || 0,
    },
  };
}

/** Valid activity filter values for admin user list. */
export const USER_ACTIVITY_FILTERS = new Set([
  'online',
  'today',
  'week',
  'month',
  'inactive30d',
  'dormant',
]);

/** Max placeholders per IN chunk (SQLite default limit is 999). */
const ONLINE_FILTER_CHUNK_SIZE = 500;

/**
 * @param {string | undefined} activity
 * @param {import('../../services/ActivityTracker.js').default | null} activityTracker
 * @returns {{ clause: string | null, params: unknown[], emptyResult?: boolean }}
 */
export function buildActivityFilterClause(activity, activityTracker) {
  if (!activity || !USER_ACTIVITY_FILTERS.has(activity)) {
    return { clause: null, params: [] };
  }

  const now = new Date();

  if (activity === 'online') {
    const onlineIds = activityTracker?.getOnlineAuthIds() ?? [];
    if (onlineIds.length === 0) {
      return { clause: null, params: [], emptyResult: true };
    }
    if (onlineIds.length <= ONLINE_FILTER_CHUNK_SIZE) {
      const placeholders = onlineIds.map(() => '?').join(',');
      return {
        clause: `ur.auth_id IN (${placeholders})`,
        params: onlineIds,
      };
    }
    const chunks = [];
    const params = [];
    for (let i = 0; i < onlineIds.length; i += ONLINE_FILTER_CHUNK_SIZE) {
      const chunk = onlineIds.slice(i, i + ONLINE_FILTER_CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      chunks.push(`ur.auth_id IN (${placeholders})`);
      params.push(...chunk);
    }
    return {
      clause: `(${chunks.join(' OR ')})`,
      params,
    };
  }

  if (activity === 'today') {
    const startToday = formatSqliteUtc(startOfUtcDay(now));
    return { clause: 'ur.last_seen_at >= ?', params: [startToday] };
  }

  if (activity === 'week') {
    const cutoff = formatSqliteUtc(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    return { clause: 'ur.last_seen_at >= ?', params: [cutoff] };
  }

  if (activity === 'month') {
    const cutoff = formatSqliteUtc(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    return { clause: 'ur.last_seen_at >= ?', params: [cutoff] };
  }

  if (activity === 'inactive30d') {
    const cutoff = formatSqliteUtc(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    return {
      clause: '(ur.last_seen_at IS NULL OR ur.last_seen_at < ?)',
      params: [cutoff],
    };
  }

  if (activity === 'dormant') {
    const cutoff = formatSqliteUtc(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));
    return {
      clause: '(ur.last_seen_at IS NULL OR ur.last_seen_at < ?)',
      params: [cutoff],
    };
  }

  return { clause: null, params: [] };
}

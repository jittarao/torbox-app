/**
 * Track consecutive TorBox PLAN_RESTRICTED_FEATURE responses so we do not disable
 * all automation rules on a single transient 403 (mirrors consecutive_auth_failures).
 */
export const up = (db) => {
  const tableInfo = db.prepare('PRAGMA table_info(user_registry)').all();
  const hasColumn = tableInfo.some((col) => col.name === 'consecutive_plan_restricted_failures');

  if (!hasColumn) {
    db.prepare(
      `
      ALTER TABLE user_registry
      ADD COLUMN consecutive_plan_restricted_failures INTEGER DEFAULT 0
    `
    ).run();
  }
};

export const down = (db) => {
  // SQLite: leave column in place
};

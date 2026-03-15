/**
 * Convert next_poll_at from ISO 8601 to SQLite datetime format so
 * getUsersDueForPolling can use the composite index.
 */
export const up = (db) => {
  db.prepare(
    `
    UPDATE user_registry
    SET next_poll_at = replace(replace(substr(next_poll_at, 1, 19), 'T', ' '), 'Z', '')
    WHERE next_poll_at LIKE '%T%'
  `
  ).run();
};

export const down = (db) => {
  // next_poll_at format not reverted; app will write SQLite format going forward
};

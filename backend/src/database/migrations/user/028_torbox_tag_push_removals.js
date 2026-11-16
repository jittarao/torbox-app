// Keep removal intent across failed pushes and process restarts.
export const up = (db) => {
  db.prepare(
    "ALTER TABLE torbox_tag_sync_pending ADD COLUMN removed_names TEXT NOT NULL DEFAULT '[]'"
  ).run();
};

export const down = (db) => {
  db.prepare('ALTER TABLE torbox_tag_sync_pending DROP COLUMN removed_names').run();
};

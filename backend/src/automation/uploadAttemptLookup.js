/**
 * Attach TorBox create cache status from upload_attempts to upload rows.
 * @param {{ db: import('better-sqlite3').Database }} userDb
 * @param {Array<{ id: number }>} uploads
 * @returns {Array<Record<string, unknown>>}
 */
export function attachCreateWasCached(userDb, uploads) {
  if (!uploads?.length) {
    return uploads;
  }

  const ids = uploads.map((upload) => upload.id).filter((id) => id != null);
  if (ids.length === 0) {
    return uploads;
  }

  const placeholders = ids.map(() => '?').join(', ');
  const rows = userDb.db
    .prepare(
      `
      SELECT upload_id, is_cached
      FROM upload_attempts
      WHERE upload_id IN (${placeholders})
        AND success = 1
      ORDER BY attempted_at DESC
    `
    )
    .all(...ids);

  const cachedByUploadId = new Map();
  for (const row of rows) {
    if (!cachedByUploadId.has(row.upload_id)) {
      cachedByUploadId.set(row.upload_id, row.is_cached === 1);
    }
  }

  return uploads.map((upload) => {
    if (!cachedByUploadId.has(upload.id)) {
      return upload;
    }
    return {
      ...upload,
      create_was_cached: cachedByUploadId.get(upload.id),
    };
  });
}

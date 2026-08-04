/**
 * Startup audit: count user DBs missing stremio_addons / tmdb_credentials.
 * Does not create tables — use this to decide whether a heal migration is needed.
 *
 * Grep after deploy: stremio_tmdb_schema_heal_summary
 */

import logger from '../utils/logger.js';
import Semaphore from '../utils/semaphore.js';

function tableExists(db, tableName) {
  return Boolean(
    db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=?").get(tableName)
  );
}

/**
 * @param {import('bun:sqlite').Database} db
 * @returns {{ missingStremio: boolean, missingTmdb: boolean, missing: string[] }}
 */
export function inspectStremioTmdbTables(db) {
  const missingStremio = !tableExists(db, 'stremio_addons');
  const missingTmdb = !tableExists(db, 'tmdb_credentials');
  const missing = [];
  if (missingStremio) missing.push('stremio_addons');
  if (missingTmdb) missing.push('tmdb_credentials');
  return { missingStremio, missingTmdb, missing };
}

/**
 * Scan active user DBs and log how many are missing stremio/tmdb tables.
 * @param {Object} masterDatabase
 * @param {Object} userDatabaseManager
 * @returns {Promise<{
 *   usersChecked: number,
 *   usersWithMissingTables: number,
 *   missingStremioAddons: number,
 *   missingTmdbCredentials: number,
 *   errors: number,
 *   healNeeded: boolean
 * }>}
 */
export async function auditStremioTmdbSchema(masterDatabase, userDatabaseManager) {
  const stats = {
    usersChecked: 0,
    usersWithMissingTables: 0,
    missingStremioAddons: 0,
    missingTmdbCredentials: 0,
    errors: 0,
  };

  if (!masterDatabase || !userDatabaseManager) {
    logger.warn('stremio_tmdb_schema_heal_summary', {
      ...stats,
      healNeeded: false,
      skipped: true,
      reason: 'missing_dependencies',
    });
    return { ...stats, healNeeded: false };
  }

  const users = masterDatabase.getActiveUsers?.() || [];
  const maxConcurrent = Math.min(
    5,
    Math.max(1, parseInt(process.env.MAX_CONCURRENT_INIT || '5', 10)),
    Math.max(1, users.length)
  );
  const semaphore = new Semaphore(maxConcurrent);

  await Promise.all(
    users.map(async (user) => {
      const authId = user.auth_id;
      if (!authId) {
        stats.errors += 1;
        return;
      }
      await semaphore.acquire();
      try {
        const connection = await userDatabaseManager.getUserDatabase(authId);
        const { missingStremio, missingTmdb, missing } = inspectStremioTmdbTables(connection.db);
        stats.usersChecked += 1;
        if (missing.length > 0) {
          stats.usersWithMissingTables += 1;
          if (missingStremio) stats.missingStremioAddons += 1;
          if (missingTmdb) stats.missingTmdbCredentials += 1;
          logger.warn('stremio_tmdb_schema_missing', { authId, missing });
        }
      } catch (error) {
        stats.errors += 1;
        logger.warn('stremio_tmdb_schema_audit_failed', {
          authId,
          error: error.message,
        });
      } finally {
        userDatabaseManager.closeConnection(authId);
        semaphore.release();
      }
    })
  );

  const summary = {
    ...stats,
    healNeeded: stats.usersWithMissingTables > 0,
  };
  logger.info('stremio_tmdb_schema_heal_summary', summary);
  return summary;
}

import fs from 'fs';
import path from 'path';
import { Database as SQLiteDatabase } from 'bun:sqlite';
import { sendSuccess, sendError, asyncHandler } from './helpers.js';
import logger from '../../utils/logger.js';

/**
 * User Database Diagnostics Routes
 * Provides diagnostic endpoints for checking database consistency
 */
export function setupDiagnosticsRoutes(router, backend) {
  // Run full diagnostics
  router.get(
    '/diagnostics',
    asyncHandler(async (req, res) => {
      const masterDb = backend.masterDatabase;
      const userDbDir = process.env.USER_DB_DIR || '/app/data/users';

      const diagnostics = {
        timestamp: new Date().toISOString(),
        statistics: {},
        issues: {
          orphanedApiKeys: [],
          orphanedUsers: [],
          duplicateAuthIds: [],
          duplicateDbPaths: [],
          missingFiles: [],
          statusMismatches: [],
          databaseIntegrityFailures: [],
          orphanedFiles: [],
        },
        summary: {
          totalIssues: 0,
          status: 'healthy',
        },
        activeUsersBreakdown: {},
      };

      try {
        // Statistics
        const apiKeysCount = masterDb.getQuery('SELECT COUNT(*) as count FROM api_keys');
        const activeApiKeysCount = masterDb.getQuery(
          'SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1'
        );
        const userRegistryCount = masterDb.getQuery('SELECT COUNT(*) as count FROM user_registry');
        const activeUsersCount = masterDb.getQuery(
          "SELECT COUNT(*) as count FROM user_registry WHERE status = 'active'"
        );

        diagnostics.statistics = {
          apiKeys: {
            total: apiKeysCount.count,
            active: activeApiKeysCount.count,
          },
          userRegistry: {
            total: userRegistryCount.count,
            active: activeUsersCount.count,
          },
        };

        // Check for API keys without user registry entries
        const orphanedApiKeys = masterDb.allQuery(
          `
            SELECT ak.auth_id, ak.key_name, ak.created_at, ak.is_active
            FROM api_keys ak
            LEFT JOIN user_registry ur ON ak.auth_id = ur.auth_id
            WHERE ur.auth_id IS NULL
          `
        );

        diagnostics.issues.orphanedApiKeys = orphanedApiKeys.map((key) => ({
          auth_id: key.auth_id,
          key_name: key.key_name || '(unnamed)',
          created_at: key.created_at,
          is_active: key.is_active === 1,
        }));

        // Check for user registry entries without API keys
        const orphanedUsers = masterDb.allQuery(
          `
            SELECT ur.auth_id, ur.db_path, ur.status, ur.created_at
            FROM user_registry ur
            LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
            WHERE ak.auth_id IS NULL
          `
        );

        diagnostics.issues.orphanedUsers = orphanedUsers.map((user) => ({
          auth_id: user.auth_id,
          db_path: user.db_path,
          status: user.status,
          created_at: user.created_at,
        }));

        // Check for duplicate auth_ids (should be 0 due to PRIMARY KEY)
        const duplicateAuthIds = masterDb.allQuery(
          `
            SELECT auth_id, COUNT(*) as count
            FROM user_registry
            GROUP BY auth_id
            HAVING COUNT(*) > 1
          `
        );

        diagnostics.issues.duplicateAuthIds = duplicateAuthIds.map((dup) => ({
          auth_id: dup.auth_id,
          count: dup.count,
        }));

        // Check for duplicate db_paths (should be 0 due to UNIQUE constraint)
        const duplicateDbPaths = masterDb.allQuery(
          `
            SELECT db_path, COUNT(*) as count
            FROM user_registry
            GROUP BY db_path
            HAVING COUNT(*) > 1
          `
        );

        diagnostics.issues.duplicateDbPaths = duplicateDbPaths.map((dup) => ({
          db_path: dup.db_path,
          count: dup.count,
        }));

        // Check for missing database files
        const allUsers = masterDb.allQuery('SELECT auth_id, db_path FROM user_registry');
        const missingFiles = [];
        let existingFiles = 0;

        allUsers.forEach((user) => {
          if (fs.existsSync(user.db_path)) {
            existingFiles++;
          } else {
            missingFiles.push({
              auth_id: user.auth_id,
              db_path: user.db_path,
            });
          }
        });

        diagnostics.issues.missingFiles = missingFiles;
        diagnostics.statistics.databaseFiles = {
          total: allUsers.length,
          existing: existingFiles,
          missing: missingFiles.length,
        };

        // Check for status mismatches between api_keys and user_registry
        const statusMismatches = masterDb.allQuery(
          `
            SELECT 
              ur.auth_id,
              ur.status as registry_status,
              ak.is_active as api_key_active,
              ur.db_path,
              ur.created_at,
              ak.key_name
            FROM user_registry ur
            INNER JOIN api_keys ak ON ur.auth_id = ak.auth_id
            WHERE (ur.status = 'active' AND ak.is_active != 1)
               OR (ur.status != 'active' AND ak.is_active = 1)
          `
        );

        diagnostics.issues.statusMismatches = statusMismatches.map((mismatch) => ({
          auth_id: mismatch.auth_id,
          registry_status: mismatch.registry_status,
          api_key_active: mismatch.api_key_active === 1,
          db_path: mismatch.db_path,
          created_at: mismatch.created_at,
          key_name: mismatch.key_name || '(unnamed)',
        }));

        // Check for orphaned database files (files in userDbDir but not in registry)
        const orphanedSqliteFiles = [];
        const orphanedWalFiles = [];
        const orphanedShmFiles = [];

        try {
          if (fs.existsSync(userDbDir)) {
            const files = fs.readdirSync(userDbDir);

            // Create sets of registered database files and base names
            const registeredPaths = new Set(allUsers.map((user) => path.basename(user.db_path)));

            const registeredBaseNames = new Set(
              allUsers.map((user) => {
                const basename = path.basename(user.db_path, '.sqlite');
                return basename;
              })
            );

            files.forEach((file) => {
              try {
                const fullPath = path.join(userDbDir, file);
                const stats = fs.statSync(fullPath);

                // Skip directories
                if (stats.isDirectory()) {
                  return;
                }

                const fileInfo = {
                  filename: file,
                  path: fullPath,
                  size: stats.size,
                  modified: stats.mtime,
                };

                // Check for .sqlite files
                if (file.endsWith('.sqlite')) {
                  if (!registeredPaths.has(file)) {
                    orphanedSqliteFiles.push(fileInfo);
                  }
                } else if (file.endsWith('-wal')) {
                  // Extract base name from WAL file: "user_abc123.sqlite-wal" → "user_abc123"
                  const baseName = file.replace(/\.sqlite-wal$/, '');
                  if (!registeredBaseNames.has(baseName)) {
                    orphanedWalFiles.push(fileInfo);
                  }
                } else if (file.endsWith('-shm')) {
                  // Extract base name from SHM file: "user_abc123.sqlite-shm" → "user_abc123"
                  const baseName = file.replace(/\.sqlite-shm$/, '');
                  if (!registeredBaseNames.has(baseName)) {
                    orphanedShmFiles.push(fileInfo);
                  }
                }
              } catch (fileError) {
                // Skip files we can't stat (permissions, etc.)
                logger.debug('Skipping file in orphaned check', {
                  file,
                  error: fileError.message,
                });
              }
            });
          }
        } catch (error) {
          logger.warn('Error checking for orphaned files', { error: error.message, userDbDir });
        }

        // Combine all orphaned files for total count
        const allOrphanedFiles = [...orphanedSqliteFiles, ...orphanedWalFiles, ...orphanedShmFiles];

        diagnostics.issues.orphanedFiles = allOrphanedFiles;
        diagnostics.issues.orphanedSqliteFiles = orphanedSqliteFiles;
        diagnostics.issues.orphanedWalFiles = orphanedWalFiles;
        diagnostics.issues.orphanedShmFiles = orphanedShmFiles;

        // Database integrity checks (sample a subset to avoid performance issues)
        const databaseIntegrityFailures = [];
        const integrityCheckLimit = 50; // Check first 50 databases to avoid timeout
        const usersToCheck = allUsers.slice(0, integrityCheckLimit);

        for (const user of usersToCheck) {
          if (fs.existsSync(user.db_path)) {
            try {
              const db = new SQLiteDatabase(user.db_path);
              const integrityResult = db.prepare('PRAGMA integrity_check').get();
              db.close();

              if (integrityResult && integrityResult.integrity_check !== 'ok') {
                databaseIntegrityFailures.push({
                  auth_id: user.auth_id,
                  db_path: user.db_path,
                  error: integrityResult.integrity_check,
                });
              }
            } catch (error) {
              databaseIntegrityFailures.push({
                auth_id: user.auth_id,
                db_path: user.db_path,
                error: `Failed to check integrity: ${error.message}`,
              });
            }
          }
        }

        diagnostics.issues.databaseIntegrityFailures = databaseIntegrityFailures;
        diagnostics.statistics.integrityChecks = {
          checked: usersToCheck.length,
          total: allUsers.length,
          failed: databaseIntegrityFailures.length,
        };

        // Active users breakdown
        const activeUsersBreakdown = masterDb.getQuery(
          `
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN ur.status = 'active' AND ak.is_active = 1 THEN 1 ELSE 0 END) as both_active,
              SUM(CASE WHEN ur.status = 'active' AND (ak.is_active = 0 OR ak.is_active IS NULL) THEN 1 ELSE 0 END) as registry_active_only,
              SUM(CASE WHEN ur.status != 'active' AND ak.is_active = 1 THEN 1 ELSE 0 END) as api_key_active_only
            FROM user_registry ur
            LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
          `
        );

        diagnostics.activeUsersBreakdown = {
          total: activeUsersBreakdown.total,
          both_active: activeUsersBreakdown.both_active || 0,
          registry_active_only: activeUsersBreakdown.registry_active_only || 0,
          api_key_active_only: activeUsersBreakdown.api_key_active_only || 0,
        };

        // Calculate summary
        const totalIssues =
          diagnostics.issues.orphanedApiKeys.length +
          diagnostics.issues.orphanedUsers.length +
          diagnostics.issues.duplicateAuthIds.length +
          diagnostics.issues.duplicateDbPaths.length +
          diagnostics.issues.missingFiles.length +
          diagnostics.issues.statusMismatches.length +
          diagnostics.issues.databaseIntegrityFailures.length +
          diagnostics.issues.orphanedFiles.length;

        diagnostics.summary.totalIssues = totalIssues;
        diagnostics.summary.status =
          totalIssues === 0
            ? 'healthy'
            : diagnostics.issues.duplicateAuthIds.length > 0 ||
                diagnostics.issues.duplicateDbPaths.length > 0 ||
                diagnostics.issues.databaseIntegrityFailures.length > 0
              ? 'critical'
              : 'warning';

        sendSuccess(res, diagnostics);
      } catch (error) {
        logger.error('Error running diagnostics', error, { endpoint: '/diagnostics' });
        sendError(res, error, 500, { endpoint: '/diagnostics' });
      }
    })
  );

  // Repair status mismatches (sync user_registry.status to api_keys.is_active)
  router.post(
    '/diagnostics/repair-status-mismatches',
    asyncHandler(async (req, res) => {
      const masterDb = backend.masterDatabase;
      const mismatches = masterDb.allQuery(
        `
        SELECT ur.auth_id, ak.is_active as api_key_active
        FROM user_registry ur
        INNER JOIN api_keys ak ON ur.auth_id = ak.auth_id
        WHERE (ur.status = 'active' AND ak.is_active != 1)
           OR (ur.status != 'active' AND ak.is_active = 1)
      `
      );
      let repaired = 0;
      for (const row of mismatches) {
        const newStatus = row.api_key_active === 1 ? 'active' : 'inactive';
        masterDb.updateUserStatus(row.auth_id, newStatus);
        repaired++;
      }
      logger.info('Repaired status mismatches', { repaired, authIds: mismatches.map((m) => m.auth_id) });
      sendSuccess(res, {
        message: `Repaired ${repaired} status mismatch(es).`,
        repaired,
        authIds: mismatches.map((m) => m.auth_id),
      });
    })
  );
}

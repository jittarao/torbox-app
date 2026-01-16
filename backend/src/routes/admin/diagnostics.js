import fs from 'fs';
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
          diagnostics.issues.missingFiles.length;

        diagnostics.summary.totalIssues = totalIssues;
        diagnostics.summary.status =
          totalIssues === 0
            ? 'healthy'
            : diagnostics.issues.duplicateAuthIds.length > 0 ||
                diagnostics.issues.duplicateDbPaths.length > 0
              ? 'critical'
              : 'warning';

        sendSuccess(res, diagnostics);
      } catch (error) {
        logger.error('Error running diagnostics', error, { endpoint: '/diagnostics' });
        sendError(res, error, 500, { endpoint: '/diagnostics' });
      }
    })
  );
}

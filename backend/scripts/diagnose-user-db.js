/**
 * Diagnostic script to check for user database inconsistencies
 *
 * Usage: node scripts/diagnose-user-db.js [master_db_path]
 *
 * This script checks for:
 * - API keys without user registry entries
 * - User registry entries without API keys
 * - Duplicate auth_ids
 * - Duplicate db_paths
 * - Orphaned database files
 */

import { Database as SQLiteDatabase } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';

const masterDbPath = process.argv[2] || process.env.MASTER_DB_PATH || '/app/data/master.db';

console.log('🔍 User Database Diagnostic Tool');
console.log('================================\n');
console.log(`Master DB Path: ${masterDbPath}\n`);

if (!fs.existsSync(masterDbPath)) {
  console.error(`❌ Master database not found at: ${masterDbPath}`);
  process.exit(1);
}

const db = new SQLiteDatabase(masterDbPath);

// Enable WAL mode
db.prepare('PRAGMA journal_mode = WAL').run();

console.log('📊 Statistics\n');

// Count total entries
const apiKeysCount = db.prepare('SELECT COUNT(*) as count FROM api_keys').get();
const activeApiKeysCount = db
  .prepare('SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1')
  .get();
const userRegistryCount = db.prepare('SELECT COUNT(*) as count FROM user_registry').get();
const activeUsersCount = db
  .prepare("SELECT COUNT(*) as count FROM user_registry WHERE status = 'active'")
  .get();

console.log(`API Keys: ${apiKeysCount.count} total, ${activeApiKeysCount.count} active`);
console.log(`User Registry: ${userRegistryCount.count} total, ${activeUsersCount.count} active\n`);

// Check for API keys without user registry entries
console.log('🔎 Checking for API keys without user registry entries...');
const orphanedApiKeys = db
  .prepare(
    `
    SELECT ak.auth_id, ak.key_name, ak.created_at, ak.is_active
    FROM api_keys ak
    LEFT JOIN user_registry ur ON ak.auth_id = ur.auth_id
    WHERE ur.auth_id IS NULL
  `
  )
  .all();

if (orphanedApiKeys.length > 0) {
  console.log(`⚠️  Found ${orphanedApiKeys.length} API keys without user registry entries:\n`);
  orphanedApiKeys.forEach((key) => {
    console.log(`  - auth_id: ${key.auth_id}`);
    console.log(`    key_name: ${key.key_name || '(unnamed)'}`);
    console.log(`    created_at: ${key.created_at}`);
    console.log(`    is_active: ${key.is_active}`);
    console.log('');
  });
} else {
  console.log('✅ All API keys have corresponding user registry entries\n');
}

// Check for user registry entries without API keys
console.log('🔎 Checking for user registry entries without API keys...');
const orphanedUsers = db
  .prepare(
    `
    SELECT ur.auth_id, ur.db_path, ur.status, ur.created_at
    FROM user_registry ur
    LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
    WHERE ak.auth_id IS NULL
  `
  )
  .all();

if (orphanedUsers.length > 0) {
  console.log(`⚠️  Found ${orphanedUsers.length} user registry entries without API keys:\n`);
  orphanedUsers.forEach((user) => {
    console.log(`  - auth_id: ${user.auth_id}`);
    console.log(`    db_path: ${user.db_path}`);
    console.log(`    status: ${user.status}`);
    console.log(`    created_at: ${user.created_at}`);
    console.log('');
  });
} else {
  console.log('✅ All user registry entries have corresponding API keys\n');
}

// Check for duplicate auth_ids (should be 0 due to PRIMARY KEY)
console.log('🔎 Checking for duplicate auth_ids...');
const duplicateAuthIds = db
  .prepare(
    `
    SELECT auth_id, COUNT(*) as count
    FROM user_registry
    GROUP BY auth_id
    HAVING COUNT(*) > 1
  `
  )
  .all();

if (duplicateAuthIds.length > 0) {
  console.log(`❌ Found ${duplicateAuthIds.length} duplicate auth_ids (CRITICAL BUG):\n`);
  duplicateAuthIds.forEach((dup) => {
    console.log(`  - auth_id: ${dup.auth_id} (appears ${dup.count} times)`);
  });
  console.log('');
} else {
  console.log('✅ No duplicate auth_ids found\n');
}

// Check for duplicate db_paths (should be 0 due to UNIQUE constraint)
console.log('🔎 Checking for duplicate db_paths...');
const duplicateDbPaths = db
  .prepare(
    `
    SELECT db_path, COUNT(*) as count
    FROM user_registry
    GROUP BY db_path
    HAVING COUNT(*) > 1
  `
  )
  .all();

if (duplicateDbPaths.length > 0) {
  console.log(`❌ Found ${duplicateDbPaths.length} duplicate db_paths (CRITICAL BUG):\n`);
  duplicateDbPaths.forEach((dup) => {
    console.log(`  - db_path: ${dup.db_path} (appears ${dup.count} times)`);
  });
  console.log('');
} else {
  console.log('✅ No duplicate db_paths found\n');
}

// Check for missing database files
console.log('🔎 Checking for missing database files...');
const userDbDir = process.env.USER_DB_DIR || '/app/data/users';
const allUsers = db.prepare('SELECT auth_id, db_path FROM user_registry').all();
let missingFiles = 0;
let existingFiles = 0;

allUsers.forEach((user) => {
  if (fs.existsSync(user.db_path)) {
    existingFiles++;
  } else {
    missingFiles++;
    if (missingFiles <= 10) {
      // Only show first 10 missing files
      console.log(`  ⚠️  Missing: ${user.db_path} (auth_id: ${user.auth_id})`);
    }
  }
});

if (missingFiles > 0) {
  console.log(`\n⚠️  Found ${missingFiles} missing database files (${existingFiles} exist)`);
  if (missingFiles > 10) {
    console.log(`  (Showing first 10, ${missingFiles - 10} more...)`);
  }
  console.log('');
} else {
  console.log(`✅ All ${existingFiles} database files exist\n`);
}

// Summary
console.log('📋 Summary\n');
console.log('================================');
const totalIssues =
  orphanedApiKeys.length + orphanedUsers.length + duplicateAuthIds.length + duplicateDbPaths.length;

if (totalIssues === 0) {
  console.log('✅ No issues found! Database is consistent.');
} else {
  console.log(`⚠️  Found ${totalIssues} issue(s):`);
  if (orphanedApiKeys.length > 0) {
    console.log(`  - ${orphanedApiKeys.length} orphaned API keys`);
  }
  if (orphanedUsers.length > 0) {
    console.log(`  - ${orphanedUsers.length} orphaned user registry entries`);
  }
  if (duplicateAuthIds.length > 0) {
    console.log(`  - ${duplicateAuthIds.length} duplicate auth_ids (CRITICAL)`);
  }
  if (duplicateDbPaths.length > 0) {
    console.log(`  - ${duplicateDbPaths.length} duplicate db_paths (CRITICAL)`);
  }
  if (missingFiles > 0) {
    console.log(`  - ${missingFiles} missing database files`);
  }
}

// Show active users breakdown
console.log('\n📊 Active Users Breakdown\n');
const activeUsersBreakdown = db
  .prepare(
    `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN ur.status = 'active' AND ak.is_active = 1 THEN 1 ELSE 0 END) as both_active,
      SUM(CASE WHEN ur.status = 'active' AND (ak.is_active = 0 OR ak.is_active IS NULL) THEN 1 ELSE 0 END) as registry_active_only,
      SUM(CASE WHEN ur.status != 'active' AND ak.is_active = 1 THEN 1 ELSE 0 END) as api_key_active_only
    FROM user_registry ur
    LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
  `
  )
  .get();

console.log(`Total users: ${activeUsersBreakdown.total}`);
console.log(`Both active (registry + API key): ${activeUsersBreakdown.both_active}`);
console.log(`Registry active only: ${activeUsersBreakdown.registry_active_only || 0}`);
console.log(`API key active only: ${activeUsersBreakdown.api_key_active_only || 0}`);

db.close();
console.log('\n✅ Diagnostic complete');

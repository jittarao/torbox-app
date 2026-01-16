# User Database Registration Analysis

## Summary

Analysis of potential bugs causing duplicate users or user database resets in the backend system.

## Issues Found

### 1. **Race Condition in `registerUser` Method** ⚠️ CRITICAL

**Location**: `backend/src/database/UserDatabaseManager.js:390-437`

**Problem**: The `registerUser` method uses a check-then-insert pattern that is not atomic:

```javascript
// Check if user already exists
let existing;
if (this.masterDbIsInstance) {
  existing = this.masterDb.getQuery('SELECT auth_id FROM user_registry WHERE auth_id = ?', [
    authId,
  ]);
} else {
  existing = this.masterDb
    .prepare('SELECT auth_id FROM user_registry WHERE auth_id = ?')
    .get(authId);
}
if (existing) {
  return authId;
}

// Insert into user registry (NOT ATOMIC - race condition possible here)
if (this.masterDbIsInstance) {
  this.masterDb.runQuery(`INSERT INTO user_registry (auth_id, db_path) VALUES (?, ?)`, [
    authId,
    dbPath,
  ]);
}
```

**Impact**:

- If two requests register the same API key simultaneously:
  1. Both requests check for existing user → both find none
  2. Both requests try to INSERT → one succeeds, one fails with UNIQUE constraint error
- The failing request may throw an unhandled error or be caught and ignored, potentially leaving the system in an inconsistent state
- While SQLite's PRIMARY KEY constraint prevents actual duplicates, the error handling is not graceful

**Fix**: Use `INSERT OR IGNORE` or wrap in a transaction, or handle constraint violations gracefully:

```javascript
// Option 1: Use INSERT OR IGNORE
this.masterDb.runQuery(`INSERT OR IGNORE INTO user_registry (auth_id, db_path) VALUES (?, ?)`, [
  authId,
  dbPath,
]);

// Option 2: Handle constraint violations
try {
  this.masterDb.runQuery(`INSERT INTO user_registry (auth_id, db_path) VALUES (?, ?)`, [
    authId,
    dbPath,
  ]);
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT' || error.message.includes('UNIQUE')) {
    // User already exists, which is fine
    logger.debug('User already exists in registry', { authId });
  } else {
    throw error;
  }
}
```

### 2. **Missing Error Handling for Constraint Violations** ⚠️ HIGH

**Location**: `backend/src/database/UserDatabaseManager.js:409-427`

**Problem**: The INSERT statement doesn't handle UNIQUE constraint violations gracefully. If a race condition occurs, the error propagates up and may cause:

- API registration to fail
- Inconsistent state between `api_keys` and `user_registry` tables
- User confusion when registration appears to fail but actually partially succeeds

**Impact**: Users might see errors when registering API keys, even though the registration partially succeeded.

### 3. **Parameter Mismatch in API Routes** ⚠️ MEDIUM

**Location**: `backend/src/routes/apiKeys.js:131,138`

**Problem**: Methods are called with 3 parameters but only accept 2:

```javascript
// Called with 3 parameters
await backend.masterDatabase.registerApiKey(apiKey, keyName, pollInterval);
await backend.userDatabaseManager.registerUser(apiKey, keyName, pollInterval);

// But method signatures only accept 2
async registerApiKey(apiKey, keyName = null)  // pollInterval is ignored
async registerUser(apiKey, keyName = null)   // pollInterval is ignored
```

**Impact**: The `pollInterval` parameter is silently ignored, which may not be the intended behavior.

### 4. **Inconsistent State Between `api_keys` and `user_registry`** ⚠️ MEDIUM

**Location**: `backend/src/routes/apiKeys.js:32-40`

**Problem**: The registration flow calls `registerApiKey` first, then `registerUser`. If `registerUser` fails:

- `api_keys` table has the entry
- `user_registry` table doesn't have the entry
- This creates an inconsistent state

**Impact**:

- `getActiveUsers()` queries join `user_registry` and `api_keys`, so users with API keys but no registry entry won't appear
- However, if `registerUser` is called again later, it will find the existing check and return early, potentially leaving the system in an inconsistent state

### 5. **Database File Recreation Without Data Loss Protection** ⚠️ LOW

**Location**: `backend/src/database/UserDatabaseManager.js:284-382`

**Problem**: In `getUserDatabase`, if the database file doesn't exist but the registry entry does, it will create a new empty database:

```javascript
// Ensure database file exists
try {
  const dbDir = path.dirname(dbPath);
  await mkdir(dbDir, { recursive: true });
  // ... creates new database if file doesn't exist
  const db = new SQLiteDatabase(dbPath);
  // ... runs migrations on empty database
}
```

**Impact**: If a user database file is accidentally deleted, it will be recreated as empty, losing all user data. However, this shouldn't cause duplicates.

## Root Cause Analysis for 670 Users

Given the issues above, here are the most likely scenarios:

### Scenario 1: Race Conditions Creating Inconsistent State

- Multiple simultaneous API key registrations
- Some succeed in `api_keys` but fail in `user_registry` due to race conditions
- Retry logic or subsequent calls create new entries
- Result: More entries than expected

### Scenario 2: Failed Registrations Leaving Orphaned Entries

- `registerApiKey` succeeds
- `registerUser` fails (constraint violation, network issue, etc.)
- Entry exists in `api_keys` but not in `user_registry`
- Later, `registerUser` is called again, but the check might not work correctly
- Result: Duplicate or inconsistent entries

### Scenario 3: Database File Deletion Without Registry Cleanup

- User database files are deleted (manual, disk cleanup, etc.)
- Registry entries remain
- New registrations create new database files
- But if the same API key is registered again, it should reuse the same `authId` and `db_path`

## Recommendations

### Immediate Fixes

1. **Fix Race Condition in `registerUser`**:

   ```javascript
   async registerUser(apiKey, keyName = null) {
     const authId = hashApiKey(apiKey);
     const dbPath = path.join(this.userDbDir, `user_${authId}.sqlite`);

     // Use INSERT OR IGNORE to handle race conditions gracefully
     try {
       if (this.masterDbIsInstance) {
         this.masterDb.runQuery(
           `INSERT OR IGNORE INTO user_registry (auth_id, db_path) VALUES (?, ?)`,
           [authId, dbPath]
         );
       } else {
         this.masterDb
           .prepare(`INSERT OR IGNORE INTO user_registry (auth_id, db_path) VALUES (?, ?)`)
           .run(authId, dbPath);
       }
     } catch (error) {
       // If INSERT OR IGNORE doesn't work, check if user exists
       const existing = this.masterDbIsInstance
         ? this.masterDb.getQuery('SELECT auth_id FROM user_registry WHERE auth_id = ?', [authId])
         : this.masterDb.prepare('SELECT auth_id FROM user_registry WHERE auth_id = ?').get(authId);

       if (!existing) {
         throw error; // Re-throw if it's not a duplicate
       }
       // User already exists, which is fine
     }

     // Invalidate cache
     cache.invalidateUserRegistry(authId);
     cache.invalidateActiveUsers();

     // Initialize the user database
     await this.getUserDatabase(authId);

     return authId;
   }
   ```

2. **Add Transaction for Atomic Registration**:
   Wrap both `registerApiKey` and `registerUser` in a transaction to ensure atomicity.

3. **Add Validation Query**:
   After registration, verify that both `api_keys` and `user_registry` have entries, and log warnings if they don't match.

### Diagnostic Queries

Run these queries to diagnose the current state:

```sql
-- Check for API keys without user registry entries
SELECT ak.auth_id, ak.key_name, ak.created_at
FROM api_keys ak
LEFT JOIN user_registry ur ON ak.auth_id = ur.auth_id
WHERE ur.auth_id IS NULL;

-- Check for user registry entries without API keys
SELECT ur.auth_id, ur.db_path, ur.created_at
FROM user_registry ur
LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
WHERE ak.auth_id IS NULL;

-- Count total users
SELECT
  (SELECT COUNT(*) FROM api_keys WHERE is_active = 1) as active_api_keys,
  (SELECT COUNT(*) FROM user_registry WHERE status = 'active') as active_users,
  (SELECT COUNT(*) FROM user_registry) as total_users;

-- Check for duplicate auth_ids (should be 0)
SELECT auth_id, COUNT(*) as count
FROM user_registry
GROUP BY auth_id
HAVING COUNT(*) > 1;

-- Check for duplicate db_paths (should be 0)
SELECT db_path, COUNT(*) as count
FROM user_registry
GROUP BY db_path
HAVING COUNT(*) > 1;
```

### Long-term Improvements

1. Add database integrity checks on startup
2. Add monitoring/alerting for inconsistent states
3. Implement cleanup job to remove orphaned entries
4. Add comprehensive logging for registration flow
5. Consider using database transactions for all registration operations

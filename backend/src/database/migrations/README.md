# Database Migrations

This directory contains database migration files for the TorBox backend. The migration system supports **dual database architecture** with separate migrations for master and user databases.

## Directory Structure

```
migrations/
├── master/          # Master database migrations (PostgreSQL)
│   ├── 000_migrations_table.js
│   └── 001_master_user_registry.js
└── user/            # User database migrations (SQLite)
    ├── 000_migrations_table.js
    ├── 001_automation_rules_schema.js
    ├── 002_torrent_shadow_schema.js
    ├── 003_torrent_telemetry_schema.js
    ├── 004_speed_history_schema.js
    └── 005_archived_downloads_schema.js
```

## Migration Types

### Master Migrations (`master/`)
- Applied to the **master database** (PostgreSQL)
- Manages user registry, API key storage, and system-wide data
- Examples: user registry, API key encryption

### User Migrations (`user/`)
- Applied to **each user's database** (SQLite)
- Manages user-specific data: automation rules, telemetry, archives
- Examples: automation rules, torrent shadow state, speed history

## Migration File Format

Migration files should follow this naming convention:
```
{version}_{description}.js
```

Where:
- `{version}` is a zero-padded 3-digit number (e.g., `001`, `002`, `003`)
- `{description}` is a snake_case description of what the migration does

Example: `002_torrent_shadow_schema.js`

## Migration Structure

Each migration file must export two functions:

```javascript
export const up = (db) => {
  // Code to apply the migration
  // db is the database instance (PostgreSQL or SQLite)
  db.prepare('CREATE TABLE ...').run();
};

export const down = (db) => {
  // Code to rollback the migration
  // This should reverse what 'up' does
  db.prepare('DROP TABLE ...').run();
};
```

## Best Practices

1. **Idempotency**: Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` to make migrations safe to run multiple times.

2. **Reversibility**: Always provide a `down` function that can reverse the migration. This is useful for development and rollbacks.

3. **Data Safety**: 
   - Never drop columns/tables without careful consideration
   - Consider data migration when changing column types
   - Test migrations on a copy of production data first

4. **Ordering**: Migrations run in alphabetical order. Use sequential version numbers to ensure correct order.

5. **Atomicity**: SQLite doesn't support transactions for DDL operations, but try to keep migrations focused and atomic.

6. **Database-Specific**: 
   - Master migrations use PostgreSQL syntax
   - User migrations use SQLite syntax
   - Be aware of differences (e.g., `SERIAL` vs `INTEGER PRIMARY KEY AUTOINCREMENT`)

## Creating a New Migration

### For Master Database

1. Create a new file in `master/` directory:
   ```bash
   # Example: master/002_add_user_preferences.js
   ```

2. Implement both `up` and `down` functions using PostgreSQL syntax:
   ```javascript
   export const up = (db) => {
     db.prepare(`
       CREATE TABLE IF NOT EXISTS user_preferences (
         id SERIAL PRIMARY KEY,
         auth_id TEXT NOT NULL REFERENCES user_registry(auth_id),
         preference_key TEXT NOT NULL,
         preference_value TEXT,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         UNIQUE(auth_id, preference_key)
       )
     `).run();
     
     db.prepare(`
       CREATE INDEX IF NOT EXISTS idx_user_preferences_auth_id 
       ON user_preferences(auth_id)
     `).run();
   };

   export const down = (db) => {
     db.prepare('DROP INDEX IF EXISTS idx_user_preferences_auth_id').run();
     db.prepare('DROP TABLE IF EXISTS user_preferences').run();
   };
   ```

### For User Database

1. Create a new file in `user/` directory:
   ```bash
   # Example: user/006_add_user_settings.js
   ```

2. Implement both `up` and `down` functions using SQLite syntax:
   ```javascript
   export const up = (db) => {
     db.prepare(`
       CREATE TABLE IF NOT EXISTS user_settings (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         setting_key TEXT NOT NULL UNIQUE,
         setting_value TEXT,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
       )
     `).run();
     
     db.prepare(`
       CREATE INDEX IF NOT EXISTS idx_user_settings_key 
       ON user_settings(setting_key)
     `).run();
   };

   export const down = (db) => {
     db.prepare('DROP INDEX IF EXISTS idx_user_settings_key').run();
     db.prepare('DROP TABLE IF EXISTS user_settings').run();
   };
   ```

3. The migration will automatically run on the next database initialization.

## Migration Execution

### Master Database
- Migrations are executed when `Database.initialize()` is called
- Applied once to the master database
- Tracked in `schema_migrations` table

### User Databases
- Migrations are executed when `UserDatabaseManager.getUserDatabase()` is called
- Applied to each user's database when first accessed
- Each user database has its own `schema_migrations` table

## Migration Status

You can check migration status programmatically:

### Master Database
```javascript
const status = masterDatabase.getMigrationStatus();
console.log(status);
// [
//   { version: '001', name: 'master_user_registry', applied: true, filename: '001_master_user_registry.js' },
//   { version: '002', name: 'add_user_preferences', applied: false, filename: '002_add_user_preferences.js' }
// ]
```

### User Database
```javascript
const userDb = await userDbManager.getUserDatabase(authId);
const status = userDb.migrationRunner.getMigrationStatus();
console.log(status);
```

## Rollback (Use with Caution)

To rollback a specific migration:

### Master Database
```javascript
await masterDatabase.rollbackMigration('002');
```

### User Database
```javascript
const userDb = await userDbManager.getUserDatabase(authId);
await userDb.migrationRunner.rollbackMigration('002');
```

**Warning**: Only rollback migrations in development. Production rollbacks should be done through new migrations that reverse the changes.

## Migration Tracking

Both master and user databases track applied migrations in a `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

The migration system:
1. Checks which migrations have been applied
2. Runs only unapplied migrations in order
3. Records applied migrations in the tracking table

## Common Patterns

### Adding a New Table
```javascript
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS new_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      -- columns
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  
  // Add indexes
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_new_table_column 
    ON new_table(column)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_new_table_column').run();
  db.prepare('DROP TABLE IF EXISTS new_table').run();
};
```

### Adding a Foreign Key
```javascript
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS related_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES parent_table(id) ON DELETE CASCADE
    )
  `).run();
};
```

### Adding an Index
```javascript
export const up = (db) => {
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_table_column 
    ON table_name(column_name)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_table_column').run();
};
```

## Testing Migrations

Before deploying migrations:

1. Test on a copy of production data
2. Verify both `up` and `down` functions work correctly
3. Check that migrations are idempotent (safe to run multiple times)
4. Ensure proper error handling for edge cases

## Troubleshooting

### Migration Fails
- Check database connection
- Verify SQL syntax for your database type (PostgreSQL vs SQLite)
- Check for conflicting migrations
- Review error logs for specific issues

### Migration Not Applied
- Verify migration file is in correct directory (`master/` or `user/`)
- Check migration version number is sequential
- Ensure migration file exports both `up` and `down` functions
- Verify database has write permissions

### Rollback Issues
- Ensure `down` function properly reverses `up` function
- Check for data dependencies that prevent rollback
- Consider creating a new migration instead of rolling back in production

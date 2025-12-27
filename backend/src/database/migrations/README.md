# Database Migrations

This directory contains database migration files for the TorBox backend.

## Migration File Format

Migration files should follow this naming convention:
```
{version}_{description}.js
```

Where:
- `{version}` is a zero-padded 3-digit number (e.g., `001`, `002`, `003`)
- `{description}` is a snake_case description of what the migration does

Example: `002_add_user_preferences.js`

## Migration Structure

Each migration file must export two functions:

```javascript
export const up = (db) => {
  // Code to apply the migration
  // db is the SQLite database instance
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

## Creating a New Migration

1. Create a new file in this directory following the naming convention:
   ```
   002_add_new_feature.js
   ```

2. Implement both `up` and `down` functions:

```javascript
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS new_feature (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_new_feature_name 
    ON new_feature(name)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_new_feature_name').run();
  db.prepare('DROP TABLE IF EXISTS new_feature').run();
};
```

3. The migration will automatically run on the next database initialization.

## Migration Status

You can check migration status programmatically:

```javascript
const status = database.getMigrationStatus();
console.log(status);
// [
//   { version: '001', name: 'initial_schema', applied: true, filename: '001_initial_schema.js' },
//   { version: '002', name: 'add_new_feature', applied: false, filename: '002_add_new_feature.js' }
// ]
```

## Rollback (Use with Caution)

To rollback a specific migration:

```javascript
await database.rollbackMigration('002');
```

**Warning**: Only rollback migrations in development. Production rollbacks should be done through new migrations that reverse the changes.

## Migration Execution

Migrations are automatically executed when `database.initialize()` is called. They run in order and only apply migrations that haven't been applied yet.

The migration system tracks applied migrations in the `schema_migrations` table.


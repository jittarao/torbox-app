import { getAllMigrations } from './migrations/index.js';

class PostgresMigrationRunner {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Get all migration files sorted by version
   */
  getMigrationFiles() {
    // Use the static migration registry instead of reading filesystem
    const migrations = getAllMigrations();
    return migrations.map(m => `${m.version}_${m.name}.js`);
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations() {
    try {
      const result = await this.pool.query(
        'SELECT version FROM schema_migrations ORDER BY version'
      );
      return result.rows.map(row => row.version);
    } catch (error) {
      // If migrations table doesn't exist, return empty array
      return [];
    }
  }

  /**
   * Mark a migration as applied
   */
  async markMigrationApplied(version, name) {
    await this.pool.query(
      `INSERT INTO schema_migrations (version, name, applied_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (version) DO NOTHING`,
      [version, name]
    );
  }

  /**
   * Check if migration is applied
   */
  async isMigrationApplied(version) {
    const result = await this.pool.query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [version]
    );
    return result.rows.length > 0;
  }

  /**
   * Extract version and name from migration filename
   */
  parseMigrationFile(filename) {
    const match = filename.match(/^(\d+)_(.+)\.js$/);
    if (!match) {
      throw new Error(`Invalid migration filename format: ${filename}`);
    }
    return {
      version: match[1],
      name: match[2]
    };
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    console.log('Running database migrations...');

    // First, ensure migrations table exists
    await this.ensureMigrationsTable();

    const migrationFiles = this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();

    let migrationsRun = 0;

    for (const file of migrationFiles) {
      const { version, name } = this.parseMigrationFile(file);

      if (appliedMigrations.includes(version)) {
        console.log(`Migration ${version}_${name} already applied, skipping`);
        continue;
      }

      try {
        console.log(`Running migration ${version}_${name}...`);
        
        // Get migration from static registry
        const { getMigration } = await import('./migrations/index.js');
        const migration = getMigration(version);

        if (!migration) {
          throw new Error(`Migration ${version} not found in registry`);
        }

        if (!migration.up || typeof migration.up !== 'function') {
          throw new Error(`Migration ${version}_${name} does not export an 'up' function`);
        }

        // Run migration in a transaction
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          await migration.up(client);
          await client.query('COMMIT');
          
          // Mark as applied
          await this.markMigrationApplied(version, name);
          migrationsRun++;
          
          console.log(`✓ Migration ${version}_${name} applied successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error(`✗ Migration ${version}_${name} failed:`, error);
        throw new Error(`Migration ${version}_${name} failed: ${error.message}`);
      }
    }

    if (migrationsRun === 0) {
      console.log('No pending migrations');
    } else {
      console.log(`Applied ${migrationsRun} migration(s)`);
    }

    return migrationsRun;
  }

  /**
   * Rollback a specific migration (if down function exists)
   */
  async rollbackMigration(version) {
    if (!(await this.isMigrationApplied(version))) {
      throw new Error(`Migration ${version} is not applied`);
    }

    try {
      // Get migration from static registry
      const { getMigration } = await import('./migrations/index.js');
      const migration = getMigration(version);

      if (!migration) {
        throw new Error(`Migration ${version} not found in registry`);
      }

      if (!migration.down || typeof migration.down !== 'function') {
        throw new Error(`Migration ${version} does not export a 'down' function`);
      }

      console.log(`Rolling back migration ${version}...`);
      
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await migration.down(client);
        await client.query('COMMIT');
        
        // Remove from applied migrations
        await this.pool.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
        
        console.log(`✓ Migration ${version} rolled back successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`✗ Rollback of migration ${version} failed:`, error);
      throw error;
    }
  }

  /**
   * Ensure migrations table exists
   */
  async ensureMigrationsTable() {
    try {
      // Check if migrations table exists
      const result = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'schema_migrations'
        )
      `);

      if (!result.rows[0].exists) {
        // Create migrations table
        await this.pool.query(`
          CREATE TABLE schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        console.log('Created schema_migrations table');
      }
    } catch (error) {
      console.error('Error ensuring migrations table:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    const migrationFiles = this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();

    return migrationFiles.map(file => {
      const { version, name } = this.parseMigrationFile(file);
      return {
        version,
        name,
        applied: appliedMigrations.includes(version),
        filename: file
      };
    });
  }
}

export default PostgresMigrationRunner;


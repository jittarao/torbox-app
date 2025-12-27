import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationRunner {
  constructor(db) {
    this.db = db;
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  /**
   * Get all migration files sorted by version
   */
  getMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.js') && file !== '000_migrations_table.js')
      .sort();

    return files;
  }

  /**
   * Get applied migrations from database
   */
  getAppliedMigrations() {
    try {
      const result = this.db.prepare(
        'SELECT version FROM schema_migrations ORDER BY version'
      ).all();
      return result.map(row => row.version);
    } catch (error) {
      // If migrations table doesn't exist, return empty array
      return [];
    }
  }

  /**
   * Mark a migration as applied
   */
  markMigrationApplied(version, name) {
    this.db.prepare(`
      INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(version, name);
  }

  /**
   * Check if migration is applied
   */
  isMigrationApplied(version) {
    const result = this.db.prepare(
      'SELECT version FROM schema_migrations WHERE version = ?'
    ).get(version);
    return !!result;
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
    const appliedMigrations = this.getAppliedMigrations();

    let migrationsRun = 0;

    for (const file of migrationFiles) {
      const { version, name } = this.parseMigrationFile(file);

      if (appliedMigrations.includes(version)) {
        console.log(`Migration ${version}_${name} already applied, skipping`);
        continue;
      }

      try {
        console.log(`Running migration ${version}_${name}...`);
        
        const migrationPath = path.join(this.migrationsDir, file);
        // Convert path to file:// URL (works cross-platform)
        const migrationUrl = pathToFileURL(migrationPath).href;
        
        const migration = await import(migrationUrl);

        if (!migration.up || typeof migration.up !== 'function') {
          throw new Error(`Migration ${file} does not export an 'up' function`);
        }

        // Run migration in a transaction-like manner
        // Note: SQLite doesn't support transactions for DDL, but we'll wrap it anyway
        migration.up(this.db);

        // Mark as applied
        this.markMigrationApplied(version, name);
        migrationsRun++;
        
        console.log(`✓ Migration ${version}_${name} applied successfully`);
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
    const migrationFiles = this.getMigrationFiles();
    const migrationFile = migrationFiles.find(file => {
      const parsed = this.parseMigrationFile(file);
      return parsed.version === version;
    });

    if (!migrationFile) {
      throw new Error(`Migration ${version} not found`);
    }

    if (!this.isMigrationApplied(version)) {
      throw new Error(`Migration ${version} is not applied`);
    }

    try {
        const migrationPath = path.join(this.migrationsDir, migrationFile);
        // Convert path to file:// URL (works cross-platform)
        const migrationUrl = pathToFileURL(migrationPath).href;
        
        const migration = await import(migrationUrl);

      if (!migration.down || typeof migration.down !== 'function') {
        throw new Error(`Migration ${migrationFile} does not export a 'down' function`);
      }

      console.log(`Rolling back migration ${version}...`);
      migration.down(this.db);

      // Remove from applied migrations
      this.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(version);
      
      console.log(`✓ Migration ${version} rolled back successfully`);
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
      const result = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='schema_migrations'
      `).get();

      if (!result) {
        // Import and run the migrations table creation
        const migrationsTablePath = path.join(this.migrationsDir, '000_migrations_table.js');
        // Convert path to file:// URL (works cross-platform)
        const migrationUrl = pathToFileURL(migrationsTablePath).href;
        
        const migrationsTable = await import(migrationUrl);
        migrationsTable.up(this.db);
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
  getMigrationStatus() {
    const migrationFiles = this.getMigrationFiles();
    const appliedMigrations = this.getAppliedMigrations();

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

export default MigrationRunner;


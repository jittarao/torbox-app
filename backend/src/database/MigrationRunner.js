import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationRunner {
  constructor(db, dbType = 'user') {
    this.db = db;
    this.dbType = dbType; // 'master' or 'user'
    this.migrationsDir = path.join(__dirname, 'migrations', dbType);
    this._migrationFilesCache = null; // Cache migration files list
  }

  /**
   * Get all migration files sorted by version
   * Caches the result to avoid repeated file system access
   */
  async getMigrationFiles(useCache = true) {
    if (useCache && this._migrationFilesCache !== null) {
      return this._migrationFilesCache;
    }

    try {
      await fsPromises.access(this.migrationsDir);
    } catch (error) {
      // Directory doesn't exist
      this._migrationFilesCache = [];
      return [];
    }

    const files = await fsPromises.readdir(this.migrationsDir);
    const migrationFiles = files.filter((file) => file.endsWith('.js')).sort();
    
    // Validate migration file naming and detect gaps
    this._validateMigrationFiles(migrationFiles);
    
    this._migrationFilesCache = migrationFiles;
    return migrationFiles;
  }

  /**
   * Validate migration files for proper naming and sequential ordering
   * @private
   */
  _validateMigrationFiles(files) {
    const versions = [];
    for (const file of files) {
      try {
        const { version } = this.parseMigrationFile(file);
        const versionNum = parseInt(version, 10);
        if (isNaN(versionNum)) {
          logger.warn(`Migration file ${file} has non-numeric version: ${version}`, {
            dbType: this.dbType,
          });
        } else {
          versions.push(versionNum);
        }
      } catch (error) {
        // Invalid filename format - already logged by parseMigrationFile
        continue;
      }
    }

    // Check for gaps in version numbers (warn, don't fail)
    if (versions.length > 0) {
      const sortedVersions = [...versions].sort((a, b) => a - b);
      for (let i = 1; i < sortedVersions.length; i++) {
        if (sortedVersions[i] !== sortedVersions[i - 1] + 1) {
          logger.warn(`Gap detected in migration versions: ${sortedVersions[i - 1]} -> ${sortedVersions[i]}`, {
            dbType: this.dbType,
          });
        }
      }
    }
  }

  /**
   * Clear migration files cache (useful for testing or after adding new migrations)
   */
  clearCache() {
    this._migrationFilesCache = null;
  }

  /**
   * Get applied migrations from database
   */
  getAppliedMigrations() {
    try {
      const result = this.db
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all();
      return result.map((row) => row.version);
    } catch (error) {
      // Check if error is due to missing table (expected) or other issues
      if (error.message && error.message.includes('no such table')) {
        // Migrations table doesn't exist yet - this is expected for new databases
        return [];
      }
      // Other database errors (e.g., closed connection) should be logged
      logger.warn('Error getting applied migrations', {
        dbType: this.dbType,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Mark a migration as applied
   */
  markMigrationApplied(version, name) {
    this.db
      .prepare(
        `
      INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `
      )
      .run(version, name);
  }

  /**
   * Check if migration is applied
   */
  isMigrationApplied(version) {
    const result = this.db
      .prepare('SELECT version FROM schema_migrations WHERE version = ?')
      .get(version);
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
      name: match[2],
    };
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    logger.verbose('Running database migrations...', { dbType: this.dbType });

    // First, ensure migrations table exists
    await this.ensureMigrationsTable();

    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = this.getAppliedMigrations();

    if (migrationFiles.length === 0) {
      logger.verbose('No migration files found', { dbType: this.dbType });
      return 0;
    }

    let migrationsRun = 0;
    const pendingMigrations = migrationFiles.filter((file) => {
      const { version } = this.parseMigrationFile(file);
      return !appliedMigrations.includes(version);
    });

    if (pendingMigrations.length === 0) {
      logger.verbose('No pending migrations', { dbType: this.dbType });
      return 0;
    }

    logger.verbose(`Found ${pendingMigrations.length} pending migration(s)`, {
      dbType: this.dbType,
      totalMigrations: migrationFiles.length,
      appliedMigrations: appliedMigrations.length,
    });

    for (const file of pendingMigrations) {
      const { version, name } = this.parseMigrationFile(file);

      try {
        logger.verbose(`Running migration ${version}_${name}...`, {
          dbType: this.dbType,
          version,
          name,
        });

        const migrationPath = path.join(this.migrationsDir, file);
        // Convert path to file:// URL (works cross-platform)
        const migrationUrl = pathToFileURL(migrationPath).href;

        const migration = await import(migrationUrl);

        if (!migration.up || typeof migration.up !== 'function') {
          throw new Error(`Migration ${file} does not export an 'up' function`);
        }

        // Run migration - support both sync and async migrations
        const migrationResult = migration.up(this.db);
        
        // If migration returns a promise, wait for it
        if (migrationResult && typeof migrationResult.then === 'function') {
          await migrationResult;
        }

        // Mark as applied (only after successful execution)
        this.markMigrationApplied(version, name);
        migrationsRun++;

        logger.verbose(`✓ Migration ${version}_${name} applied successfully`, {
          dbType: this.dbType,
          version,
          name,
        });
      } catch (error) {
        // Enhanced error logging with context
        logger.error(`✗ Migration ${version}_${name} failed`, error, {
          dbType: this.dbType,
          version,
          name,
          file,
          errorMessage: error.message,
          errorStack: error.stack,
        });

        // Provide more context in error message
        const errorMessage = `Migration ${version}_${name} failed for ${this.dbType} database: ${error.message}`;
        const migrationError = new Error(errorMessage);
        migrationError.version = version;
        migrationError.name = name;
        migrationError.dbType = this.dbType;
        migrationError.originalError = error;
        throw migrationError;
      }
    }

    logger.verbose(`Applied ${migrationsRun} migration(s)`, {
      dbType: this.dbType,
      migrationsRun,
    });

    return migrationsRun;
  }

  /**
   * Rollback a specific migration (if down function exists)
   */
  async rollbackMigration(version) {
    const migrationFiles = await this.getMigrationFiles();
    const migrationFile = migrationFiles.find((file) => {
      const parsed = this.parseMigrationFile(file);
      return parsed.version === version;
    });

    if (!migrationFile) {
      throw new Error(`Migration ${version} not found for ${this.dbType} database`);
    }

    if (!this.isMigrationApplied(version)) {
      throw new Error(`Migration ${version} is not applied for ${this.dbType} database`);
    }

    try {
      const migrationPath = path.join(this.migrationsDir, migrationFile);
      // Convert path to file:// URL (works cross-platform)
      const migrationUrl = pathToFileURL(migrationPath).href;

      const migration = await import(migrationUrl);

      if (!migration.down || typeof migration.down !== 'function') {
        throw new Error(`Migration ${migrationFile} does not export a 'down' function`);
      }

      logger.verbose(`Rolling back migration ${version}...`, {
        dbType: this.dbType,
        version,
      });

      // Support both sync and async rollback
      const rollbackResult = migration.down(this.db);
      if (rollbackResult && typeof rollbackResult.then === 'function') {
        await rollbackResult;
      }

      // Remove from applied migrations (only after successful rollback)
      this.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(version);

      logger.verbose(`✓ Migration ${version} rolled back successfully`, {
        dbType: this.dbType,
        version,
      });
    } catch (error) {
      logger.error(`✗ Rollback of migration ${version} failed`, error, {
        dbType: this.dbType,
        version,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Ensure migrations table exists
   */
  async ensureMigrationsTable() {
    try {
      // Check if migrations table exists
      const result = this.db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='schema_migrations'
      `
        )
        .get();

      if (!result) {
        // Import and run the migrations table creation
        const migrationsTablePath = path.join(this.migrationsDir, '000_migrations_table.js');
        
        try {
          await fsPromises.access(migrationsTablePath);
        } catch (error) {
          // Migrations table creation file doesn't exist - create table directly
          logger.warn('Migrations table creation file not found, creating table directly', {
            dbType: this.dbType,
            path: migrationsTablePath,
          });
          
          this.db.prepare(
            `
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `
          ).run();
          
          logger.verbose(`Created schema_migrations table for ${this.dbType} database`);
          return;
        }

        // Convert path to file:// URL (works cross-platform)
        const migrationUrl = pathToFileURL(migrationsTablePath).href;

        const migrationsTable = await import(migrationUrl);
        
        if (!migrationsTable.up || typeof migrationsTable.up !== 'function') {
          throw new Error('Migrations table creation file does not export an "up" function');
        }

        const createResult = migrationsTable.up(this.db);
        if (createResult && typeof createResult.then === 'function') {
          await createResult;
        }

        logger.verbose(`Created schema_migrations table for ${this.dbType} database`);
      }
    } catch (error) {
      logger.error('Error ensuring migrations table', error, {
        dbType: this.dbType,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    const migrationFiles = await this.getMigrationFiles();
    const appliedMigrations = this.getAppliedMigrations();

    return migrationFiles.map((file) => {
      const { version, name } = this.parseMigrationFile(file);
      return {
        version,
        name,
        applied: appliedMigrations.includes(version),
        filename: file,
      };
    });
  }
}

export default MigrationRunner;

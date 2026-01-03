import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import PostgresMigrationRunner from './PostgresMigrationRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PostgresDatabase {
  constructor() {
    this.pool = null;
    this.migrationRunner = null;
    
    // Get connection pool size from env (default 20)
    const poolSize = parseInt(process.env.DB_POOL_SIZE || '20', 10);
    
    // Parse DATABASE_URL or construct from individual components
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Create connection pool
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    // Initialize migration runner
    this.migrationRunner = new PostgresMigrationRunner(this.pool);
  }

  /**
   * Initialize database connection and run migrations
   */
  async initialize() {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      console.log('PostgreSQL connection established');

      // Run migrations
      await this.migrationRunner.runMigrations();
      
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get a client from the pool
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Execute a query and return result
   */
  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries (over 1 second)
      if (duration > 1000) {
        console.warn('Slow query detected:', { text, duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('Query error:', { text, params, error: error.message });
      throw error;
    }
  }

  /**
   * Execute a query and return single row
   */
  async queryOne(text, params = []) {
    const result = await this.query(text, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryAll(text, params = []) {
    const result = await this.query(text, params);
    return result.rows;
  }

  /**
   * Begin a transaction
   */
  async beginTransaction() {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return client;
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(client) {
    try {
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(client) {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  /**
   * Batch insert snapshots efficiently
   */
  async batchInsertSnapshots(snapshots) {
    if (snapshots.length === 0) {
      return;
    }

    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      // Use multi-row INSERT for batch inserts
      // Process in chunks to avoid parameter limit (PostgreSQL has ~65535 parameter limit)
      const chunkSize = 100;
      
      for (let i = 0; i < snapshots.length; i += chunkSize) {
        const chunk = snapshots.slice(i, i + chunkSize);
        const values = [];
        const placeholders = [];
        let paramIndex = 1;

        for (const snapshot of chunk) {
          const rowPlaceholders = [];
          rowPlaceholders.push(`$${paramIndex++}`); // user_id
          rowPlaceholders.push(`$${paramIndex++}`); // torrent_id
          rowPlaceholders.push(`$${paramIndex++}`); // snapshot_data
          rowPlaceholders.push(`$${paramIndex++}`); // state
          rowPlaceholders.push(`$${paramIndex++}`); // progress
          rowPlaceholders.push(`$${paramIndex++}`); // download_speed
          rowPlaceholders.push(`$${paramIndex++}`); // upload_speed
          rowPlaceholders.push(`$${paramIndex++}`); // seeds
          rowPlaceholders.push(`$${paramIndex++}`); // peers
          rowPlaceholders.push(`$${paramIndex++}`); // ratio
          rowPlaceholders.push(`$${paramIndex++}`); // created_at
          
          placeholders.push(`(${rowPlaceholders.join(', ')})`);
          
          values.push(
            snapshot.user_id,
            snapshot.torrent_id,
            JSON.stringify(snapshot.snapshot_data),
            snapshot.state,
            snapshot.progress || 0,
            snapshot.download_speed || 0,
            snapshot.upload_speed || 0,
            snapshot.seeds || 0,
            snapshot.peers || 0,
            snapshot.ratio || 0,
            snapshot.created_at || new Date()
          );
        }

        const sql = `
          INSERT INTO torrent_snapshots 
            (user_id, torrent_id, snapshot_data, state, progress, download_speed, upload_speed, seeds, peers, ratio, created_at)
          VALUES ${placeholders.join(', ')}
        `;

        await client.query(sql, values);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database connection pool closed');
    }
  }

  /**
   * Get migration status
   */
  getMigrationStatus() {
    if (!this.migrationRunner) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.migrationRunner.getMigrationStatus();
  }
}

export default PostgresDatabase;


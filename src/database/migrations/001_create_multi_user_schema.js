/**
 * Migration: Create multi-user schema
 * Created: 2024-01-01
 * 
 * Creates all tables for multi-user support:
 * - users: Store user API keys and metadata
 * - torrent_snapshots: Store historical torrent states
 * - automation_rules: Per-user automation rules
 * - rule_execution_log: Execution history
 */

export const up = async (client) => {
  // Create users table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      torbox_api_key TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_polled_at TIMESTAMP,
      is_active BOOLEAN NOT NULL DEFAULT true,
      next_poll_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create index on next_poll_at for efficient polling queries
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_users_next_poll_at 
    ON users(next_poll_at) 
    WHERE is_active = true
  `);

  // Create index on is_active for filtering active users
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_users_is_active 
    ON users(is_active)
  `);

  // Create torrent_snapshots table
  await client.query(`
    CREATE TABLE IF NOT EXISTS torrent_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      torrent_id TEXT NOT NULL,
      snapshot_data JSONB NOT NULL,
      state VARCHAR(50) NOT NULL,
      progress DECIMAL(5,2) DEFAULT 0,
      download_speed BIGINT DEFAULT 0,
      upload_speed BIGINT DEFAULT 0,
      seeds INTEGER DEFAULT 0,
      peers INTEGER DEFAULT 0,
      ratio DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes for torrent_snapshots
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_user_torrent_created 
    ON torrent_snapshots(user_id, torrent_id, created_at DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_user_state_created 
    ON torrent_snapshots(user_id, state, created_at)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_user_torrent_state 
    ON torrent_snapshots(user_id, torrent_id, state)
  `);

  // Create automation_rules table
  await client.query(`
    CREATE TABLE IF NOT EXISTS automation_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      trigger_config JSONB NOT NULL,
      conditions JSONB NOT NULL,
      action_config JSONB NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create index on automation_rules
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_rules_user_enabled 
    ON automation_rules(user_id, enabled)
  `);

  // Create rule_execution_log table
  await client.query(`
    CREATE TABLE IF NOT EXISTS rule_execution_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      execution_type VARCHAR(50) NOT NULL,
      items_processed INTEGER NOT NULL DEFAULT 0,
      success BOOLEAN NOT NULL DEFAULT true,
      error_message TEXT,
      executed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Create index on rule_execution_log
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_execution_log_user_rule_executed 
    ON rule_execution_log(user_id, rule_id, executed_at DESC)
  `);
};

export const down = async (client) => {
  // Drop tables in reverse order (respecting foreign keys)
  await client.query('DROP TABLE IF EXISTS rule_execution_log');
  await client.query('DROP TABLE IF EXISTS automation_rules');
  await client.query('DROP TABLE IF EXISTS torrent_snapshots');
  await client.query('DROP TABLE IF EXISTS users');
};


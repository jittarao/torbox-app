/**
 * Migration registry
 * 
 * This file registers all migrations so Next.js can bundle them statically.
 * When adding a new migration, import it here and add it to the migrations array.
 */

import * as migration001 from './001_create_multi_user_schema.js';

// Registry of all migrations
// Format: { version: string, name: string, up: function, down?: function }
export const migrations = [
  {
    version: '001',
    name: 'create_multi_user_schema',
    up: migration001.up,
    down: migration001.down,
  },
];

// Helper to get migration by version
export function getMigration(version) {
  return migrations.find(m => m.version === version);
}

// Helper to get all migrations sorted by version
export function getAllMigrations() {
  return [...migrations].sort((a, b) => a.version.localeCompare(b.version));
}


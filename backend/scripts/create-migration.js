#!/usr/bin/env node

/**
 * Helper script to create a new migration file
 * Usage: node scripts/create-migration.js <description>
 * Example: node scripts/create-migration.js add_user_preferences
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, '../src/database/migrations');

// Get description from command line
const description = process.argv[2];

if (!description) {
  console.error('Error: Migration description is required');
  console.log('Usage: node scripts/create-migration.js <description>');
  console.log('Example: node scripts/create-migration.js add_user_preferences');
  process.exit(1);
}

// Ensure migrations directory exists
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

// Get existing migration files to determine next version
const existingFiles = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.js') && file.match(/^\d+_/))
  .sort();

let nextVersion = '001';
if (existingFiles.length > 0) {
  const lastFile = existingFiles[existingFiles.length - 1];
  const lastVersion = parseInt(lastFile.match(/^(\d+)_/)[1]);
  nextVersion = String(lastVersion + 1).padStart(3, '0');
}

// Create migration filename
const filename = `${nextVersion}_${description}.js`;
const filepath = path.join(migrationsDir, filename);

// Migration template
const template = `/**
 * Migration: ${description}
 * Created: ${new Date().toISOString()}
 */
export const up = (db) => {
  // TODO: Implement migration
  // Example:
  // db.prepare(\`
  //   CREATE TABLE IF NOT EXISTS example (
  //     id INTEGER PRIMARY KEY AUTOINCREMENT,
  //     name TEXT NOT NULL,
  //     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  //   )
  // \`).run();
};

export const down = (db) => {
  // TODO: Implement rollback
  // Example:
  // db.prepare('DROP TABLE IF EXISTS example').run();
};
`;

// Write migration file
fs.writeFileSync(filepath, template, 'utf8');

console.log(`✓ Created migration: ${filename}`);
console.log(`  Path: ${filepath}`);
console.log(`\nNext steps:`);
console.log(`  1. Edit ${filename} and implement the 'up' and 'down' functions`);
console.log(`  2. Test the migration locally`);
console.log(`  3. The migration will run automatically on next database initialization`);


// This file should only be imported in Node.js runtime
// Use lazy loading to avoid Edge runtime issues

let PostgresDatabase = null;
let isMultiUserBackendEnabled = null;
let modulesLoaded = false;

let dbInstance = null;

/**
 * Lazy load database modules (only in Node.js runtime)
 * This must be called before using getDatabase() in Node.js runtime
 */
async function loadDatabaseModules() {
  if (modulesLoaded) {
    return;
  }
  
  // Check if we're in Node.js runtime
  if (typeof process === 'undefined' || process.env.NEXT_RUNTIME === 'edge') {
    return;
  }
  
  try {
    if (!PostgresDatabase) {
      PostgresDatabase = (await import('./PostgresDatabase.js')).default;
    }
    if (!isMultiUserBackendEnabled) {
      isMultiUserBackendEnabled = (await import('../utils/backendConfig.js')).isMultiUserBackendEnabled;
    }
    modulesLoaded = true;
  } catch (error) {
    console.error('Failed to load database modules:', error);
  }
}

/**
 * Synchronously load modules if in Node.js runtime
 * This is a fallback for synchronous calls
 */
function ensureModulesLoaded() {
  if (modulesLoaded) {
    return;
  }
  
  // Check if we're in Node.js runtime
  if (typeof process === 'undefined' || process.env.NEXT_RUNTIME === 'edge') {
    return;
  }
  
  // Try to load synchronously (only works if already initialized)
  // This is a best-effort approach
  try {
    // Use require-like import if available (Node.js only)
    if (typeof require !== 'undefined') {
      if (!PostgresDatabase) {
        PostgresDatabase = require('./PostgresDatabase.js').default;
      }
      if (!isMultiUserBackendEnabled) {
        isMultiUserBackendEnabled = require('../utils/backendConfig.js').isMultiUserBackendEnabled;
      }
      modulesLoaded = true;
    }
  } catch (error) {
    // Ignore - modules will be loaded asynchronously
  }
}

/**
 * Get or create database instance (singleton)
 * Returns null if backend is disabled or DATABASE_URL is not set
 * Note: This should only be called in Node.js runtime (API routes)
 */
export function getDatabase() {
  // This function should only be called in Node.js runtime
  // If called in Edge runtime, return null immediately
  if (typeof process === 'undefined' || process.env.NEXT_RUNTIME === 'edge') {
    return null;
  }
  
  // Try to ensure modules are loaded
  ensureModulesLoaded();
  
  // If modules aren't loaded yet, return null
  // They will be loaded by initializeDatabase()
  if (!PostgresDatabase || !isMultiUserBackendEnabled) {
    return null;
  }
  
  // Check if backend is enabled first
  if (!isMultiUserBackendEnabled()) {
    return null;
  }
  
  if (!process.env.DATABASE_URL) {
    return null;
  }
  
  if (!dbInstance) {
    try {
      dbInstance = new PostgresDatabase();
    } catch (error) {
      console.error('Failed to create database instance:', error);
      return null;
    }
  }
  return dbInstance;
}

/**
 * Check if database is available
 */
export function isDatabaseAvailable() {
  return !!getDatabase();
}

/**
 * Initialize database (call this on server startup)
 * Returns null if backend is disabled or DATABASE_URL is not set
 */
export async function initializeDatabase() {
  // This should only be called in Node.js runtime
  if (typeof process === 'undefined' || process.env.NEXT_RUNTIME === 'edge') {
    return null;
  }
  
  // Load modules dynamically
  await loadDatabaseModules();
  
  // Check if backend is enabled first
  if (!isMultiUserBackendEnabled()) {
    console.log('Multi-user backend is disabled, skipping database initialization');
    return null;
  }
  
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not set, skipping database initialization');
    return null;
  }
  
  const db = getDatabase();
  if (!db) {
    return null;
  }
  
  try {
    await db.initialize();
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return null;
  }
}

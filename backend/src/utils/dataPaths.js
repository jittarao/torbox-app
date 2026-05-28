import path from 'path';

/**
 * Resolve persisted data paths.
 * Defaults to {cwd}/data/... so `bun run dev` from backend/ uses backend/data,
 * and Docker (WORKDIR /app) uses /app/data without extra env vars.
 */
function resolveSqlitePath(configuredPath) {
  if (configuredPath.startsWith('sqlite://')) {
    return configuredPath.replace('sqlite://', '');
  }
  return configuredPath;
}

export function getMasterDbPath() {
  const configured = process.env.MASTER_DB_PATH || path.join(process.cwd(), 'data', 'master.db');
  return resolveSqlitePath(configured);
}

export function getUserDbDir() {
  return process.env.USER_DB_DIR || path.join(process.cwd(), 'data', 'users');
}

export function getUploadStorageDir() {
  return process.env.UPLOAD_STORAGE_DIR || path.join(process.cwd(), 'data', 'uploads');
}

export function getUserDbPath(authId) {
  return path.join(getUserDbDir(), `user_${authId}.sqlite`);
}

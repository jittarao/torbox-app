import express from 'express';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';
import DatabaseMaster from '../../../database/Database.js';
import UserDatabaseManager from '../../../database/UserDatabaseManager.js';
import { createRequireRegisteredUser } from '../../../middleware/userAuth.js';
import { setupUploadsRoutes } from '../../uploads.js';

export async function createUploadTestEnv() {
  const tempDir = path.join(
    process.cwd(),
    'data',
    `test-upload-routes-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  mkdirSync(path.join(tempDir, 'users'), { recursive: true });
  mkdirSync(path.join(tempDir, 'uploads'), { recursive: true });

  process.env.MASTER_DB_PATH = path.join(tempDir, 'master.db');
  process.env.USER_DB_DIR = path.join(tempDir, 'users');
  process.env.UPLOAD_STORAGE_DIR = path.join(tempDir, 'uploads');

  const masterDatabase = new DatabaseMaster();
  await masterDatabase.initialize();

  const userDatabaseManager = new UserDatabaseManager(masterDatabase, path.join(tempDir, 'users'));

  const apiKey = 'tb-test-api-key-0123456789abcdef0123456789abcdef';
  const { authId } = await masterDatabase.registerApiKey(apiKey, 'test-key');

  return { tempDir, masterDatabase, userDatabaseManager, apiKey, authId };
}

export function cleanupUploadTestEnv({ tempDir, masterDatabase, userDatabaseManager }) {
  try {
    userDatabaseManager?.closeAll?.();
    masterDatabase?.close?.();
  } catch (_) {
    // ignore cleanup errors
  }
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.MASTER_DB_PATH;
  delete process.env.USER_DB_DIR;
  delete process.env.UPLOAD_STORAGE_DIR;
}

export function buildUploadApp({
  masterDatabase,
  userDatabaseManager,
  uploadProcessor = { isRunning: false },
  uploadQuotaService = null,
}) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const backend = {
    requireRegisteredUser: createRequireRegisteredUser(() => masterDatabase),
    userDatabaseManager,
    masterDatabase,
    uploadProcessor,
    userRateLimiter: (_req, _res, next) => next(),
    uploadQuotaService,
  };

  setupUploadsRoutes(app, backend);
  return app;
}

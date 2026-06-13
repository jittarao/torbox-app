import express from 'express';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';
import DatabaseMaster from '../../../database/Database.js';
import UserDatabaseManager from '../../../database/UserDatabaseManager.js';
import { createRequireRegisteredUser } from '../../../middleware/userAuth.js';

export async function createBackendTestEnv() {
  const tempDir = path.join(
    process.cwd(),
    'data',
    `test-backend-routes-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
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

export function cleanupBackendTestEnv({ tempDir, masterDatabase, userDatabaseManager }) {
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

export function createFakeUploadQuotaService() {
  const tiers = new Map();
  return {
    buildUsageSnapshot(authId, fallbackTier = 'limited') {
      const tier = tiers.get(authId) || fallbackTier;
      return {
        tier,
        fileCount: 0,
        storageBytes: 0,
        storageFormatted: '0 B',
        limitStorageFormatted: '100 MB',
        limits: { maxFiles: 500, maxStorageBytes: 100 * 1024 * 1024 },
        overQuota: false,
      };
    },
    getUsage(authId) {
      const tier = tiers.get(authId) || 'limited';
      return {
        tier,
        fileCount: 0,
        storageBytes: 0,
      };
    },
    setTier(authId, tier) {
      tiers.set(authId, tier);
    },
    getAdminSummary() {
      return {
        totalUsers: 1,
        limitedUsers: 1,
        unlimitedUsers: 0,
      };
    },
    async enforceQuotaForAllLimitedUsers() {
      return { deleted: 0, freedBytes: 0 };
    },
  };
}

export function buildBackendApp({
  masterDatabase,
  userDatabaseManager,
  routeSetupFn,
  uploadProcessor = { isRunning: false },
  uploadQuotaService = null,
  pollingScheduler = null,
  eventNotifier = null,
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
    pollingScheduler,
    eventNotifier,
  };

  routeSetupFn(app, backend);
  return app;
}

export function createMockPollingScheduler() {
  return {
    refreshPollers: () => Promise.resolve(),
    invalidateCachedEngine: () => {},
    runWithPipelineLock: async () => ({
      ruleId: 1,
      ruleName: 'Mock Rule',
      successCount: 0,
      executed: true,
      skipped: false,
    }),
  };
}

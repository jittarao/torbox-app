/**
 * Upload quota enforcement for LIMITED tier users.
 *
 * Assumptions:
 * - Automation rules and pending_actions do not reference uploads.id.
 * - upload_attempts rows are audit-only and survive upload row deletion.
 * - TorBox-side jobs are unaffected; only local staging artifacts are evicted.
 * - Re-download works until the staged file is hard-deleted.
 */
import logger from '../utils/logger.js';
import {
  deleteUploadFile,
  fileExists,
  getUserUploadFiles,
  getUploadFilePath,
} from '../utils/fileStorage.js';
import { stat } from 'fs/promises';
import {
  getUploadQuotaLimits,
  isUnlimitedTier,
  UPLOAD_TIERS,
} from '../config/uploadQuota.js';

const ACTIVE_STATUSES = new Set(['queued', 'processing']);
const DELETABLE_STATUSES = new Set(['completed', 'failed']);

export default class UploadQuotaService {
  constructor(masterDatabase) {
    this.masterDatabase = masterDatabase;
  }

  getLimits() {
    return getUploadQuotaLimits();
  }

  getTier(authId) {
    return this.masterDatabase.getUploadTier(authId);
  }

  setTier(authId, tier) {
    this.masterDatabase.setUploadTier(authId, tier);
  }

  isOverQuota(usage, limits) {
    return usage.fileCount > limits.maxFiles || usage.storageBytes > limits.maxStorageBytes;
  }

  buildUsageSnapshot(authId, tier = null) {
    const resolvedTier = tier ?? this.getTier(authId);
    const counters = this.masterDatabase.getUploadQuotaCounters(authId);
    const limits = this.getLimits();
    const usage = {
      tier: resolvedTier,
      fileCount: counters.fileCount,
      storageBytes: counters.storageBytes,
      limits,
      overQuota: false,
      storageFormatted: formatBytes(counters.storageBytes),
      limitStorageFormatted: formatBytes(limits.maxStorageBytes),
    };

    if (!isUnlimitedTier(resolvedTier)) {
      usage.overQuota = this.isOverQuota(
        { fileCount: counters.fileCount, storageBytes: counters.storageBytes },
        limits
      );
    }

    return usage;
  }

  getUsage(authId) {
    return this.buildUsageSnapshot(authId);
  }

  /**
   * After a file is staged on disk (before queue row may exist).
   */
  async onFileStaged(authId, bytesAdded, userDb = null) {
    if (!bytesAdded || bytesAdded <= 0) return;
    this.masterDatabase.adjustUploadQuotaCounters(authId, 0, bytesAdded);
    if (userDb) {
      await this.enforceQuota(authId, userDb);
    }
  }

  /**
   * After storage bytes are removed (manual file delete or orphan eviction).
   */
  onFileRemoved(authId, bytesRemoved) {
    if (!bytesRemoved || bytesRemoved <= 0) return;
    this.masterDatabase.adjustUploadQuotaCounters(authId, 0, -bytesRemoved);
  }

  /**
   * After upload row(s) are inserted.
   * @param {{ excludeUploadIds?: number[], newUploadIds?: number[] }} opts
   */
  async onUploadRecorded(authId, userDb, opts = {}) {
    const { excludeUploadIds = [], newUploadIds = [] } = opts;

    if (newUploadIds.length > 0) {
      const placeholders = newUploadIds.map(() => '?').join(',');
      const rows = userDb.db
        .prepare(`SELECT id, file_path FROM uploads WHERE id IN (${placeholders})`)
        .all(...newUploadIds);

      for (const row of rows) {
        if (!row.file_path) continue;
        const sizeBytes = await this.resolveAndPersistFileSize(userDb, row.id, row.file_path);
        if (sizeBytes > 0) {
          const exists = await fileExists(row.file_path);
          if (exists) {
            this.masterDatabase.adjustUploadQuotaCounters(authId, 1, 0);
          }
        }
      }
    }

    await this.enforceQuota(authId, userDb, { excludeUploadIds });
  }

  /**
   * After a user-initiated upload delete (counters adjusted separately if needed).
   */
  onUploadDeleted(authId, fileSizeBytes, hadRetainedFile) {
    if (!hadRetainedFile) return;
    const size = fileSizeBytes || 0;
    this.masterDatabase.adjustUploadQuotaCounters(authId, -1, -size);
  }

  async resolveAndPersistFileSize(userDb, uploadId, filePath) {
    try {
      const absolutePath = getUploadFilePath(filePath);
      const stats = await stat(absolutePath);
      const sizeBytes = stats.size;
      userDb.db
        .prepare('UPDATE uploads SET file_size_bytes = ? WHERE id = ?')
        .run(sizeBytes, uploadId);
      return sizeBytes;
    } catch {
      return 0;
    }
  }

  isDeletable(upload, { excludeUploadIds = new Set() } = {}) {
    if (!upload?.file_path) return false;
    if (upload.file_deleted) return false;
    if (ACTIVE_STATUSES.has(upload.status)) return false;
    if (excludeUploadIds.has(upload.id)) return false;
    return DELETABLE_STATUSES.has(upload.status);
  }

  async enforceQuota(authId, userDb, opts = {}) {
    if (isUnlimitedTier(this.getTier(authId))) return { evicted: 0 };

    const limits = this.getLimits();
    const excludeUploadIds = new Set(opts.excludeUploadIds || []);
    let evicted = 0;
    const maxIterations = 10000;

    for (let i = 0; i < maxIterations; i++) {
      const usage = this.masterDatabase.getUploadQuotaCounters(authId);
      if (!this.isOverQuota(usage, limits)) {
        break;
      }

      const candidate = await this.findOldestDeletableUpload(authId, userDb, excludeUploadIds);
      if (candidate) {
        const deleted = await this.deleteUpload(authId, userDb, candidate, 'quota_eviction');
        if (deleted) evicted++;
        else break;
        continue;
      }

      const orphanEvicted = await this.evictOldestOrphanFile(authId, userDb);
      if (orphanEvicted) {
        evicted++;
        continue;
      }

      logger.warn('Upload quota enforcement stalled — no eligible deletions', {
        authId,
        usage,
        limits,
      });
      break;
    }

    return { evicted };
  }

  async findOldestDeletableUpload(authId, userDb, excludeUploadIds) {
    const rows = userDb.db
      .prepare(
        `
        SELECT id, file_path, status, file_deleted, file_size_bytes, created_at
        FROM uploads
        WHERE file_path IS NOT NULL
          AND (file_deleted IS NULL OR file_deleted = 0)
          AND status IN ('completed', 'failed')
        ORDER BY created_at ASC, id ASC
      `
      )
      .all();

    for (const row of rows) {
      if (!this.isDeletable(row, { excludeUploadIds })) continue;
      const exists = await fileExists(row.file_path);
      if (exists) return row;
    }

    return null;
  }

  async evictOldestOrphanFile(authId, userDb) {
    const referencedPaths = new Set(
      userDb.db
        .prepare(
          `
          SELECT file_path FROM uploads
          WHERE file_path IS NOT NULL
            AND (file_deleted IS NULL OR file_deleted = 0)
        `
        )
        .all()
        .map((r) => r.file_path)
    );

    const files = await getUserUploadFiles(authId);
    const orphan = files.find((f) => !referencedPaths.has(f.relativePath));
    if (!orphan) return false;

    try {
      await deleteUploadFile(authId, orphan.relativePath);
      this.onFileRemoved(authId, orphan.size);
      logger.info('Orphan staged file evicted for quota', {
        authId,
        filePath: orphan.relativePath,
        size: orphan.size,
      });
      return true;
    } catch (error) {
      logger.error('Failed to evict orphan staged file', error, {
        authId,
        filePath: orphan.relativePath,
      });
      return false;
    }
  }

  /**
   * Hard-delete an upload row and its staged file.
   * @returns {Promise<boolean>} true if deleted
   */
  async deleteUpload(authId, userDb, upload, reason = 'manual') {
    if (!this.isDeletable(upload) && reason === 'quota_eviction') {
      const current = userDb.db
        .prepare('SELECT id, file_path, status, file_deleted, file_size_bytes FROM uploads WHERE id = ?')
        .get(upload.id);
      if (!current || ACTIVE_STATUSES.has(current.status)) {
        return false;
      }
      upload = current;
    }

    const fileSizeBytes = upload.file_size_bytes || 0;
    let hadFile = false;

    if (upload.file_path) {
      const exists = await fileExists(upload.file_path);
      if (exists) {
        hadFile = true;
        try {
          await deleteUploadFile(authId, upload.file_path);
        } catch (error) {
          logger.error('Failed to delete upload file during eviction', error, {
            authId,
            uploadId: upload.id,
            reason,
          });
          return false;
        }
      }
    }

    const currentUpload = userDb.db.prepare('SELECT status FROM uploads WHERE id = ?').get(upload.id);
    if (!currentUpload) return false;

    if (ACTIVE_STATUSES.has(currentUpload.status)) {
      return false;
    }

    userDb.db.prepare('DELETE FROM uploads WHERE id = ?').run(upload.id);

    if (currentUpload.status === 'queued' || currentUpload.status === 'processing') {
      this.masterDatabase.decrementUploadCounter(authId);
    }

    if (hadFile) {
      this.masterDatabase.adjustUploadQuotaCounters(authId, -1, -fileSizeBytes);
    }

    logger.info('Upload hard-deleted', {
      authId,
      uploadId: upload.id,
      reason,
      hadFile,
      fileSizeBytes,
    });

    return true;
  }

  async recalculateUsage(authId, userDb) {
    const rows = userDb.db
      .prepare(
        `
        SELECT id, file_path, file_deleted, file_size_bytes
        FROM uploads
        WHERE file_path IS NOT NULL
          AND (file_deleted IS NULL OR file_deleted = 0)
      `
      )
      .all();

    let fileCount = 0;
    let storageBytes = 0;
    const referencedPaths = new Set();

    for (const row of rows) {
      const exists = await fileExists(row.file_path);
      if (!exists) continue;

      let sizeBytes = row.file_size_bytes;
      if (!sizeBytes || sizeBytes <= 0) {
        sizeBytes = await this.resolveAndPersistFileSize(userDb, row.id, row.file_path);
      }

      fileCount++;
      storageBytes += sizeBytes || 0;
      referencedPaths.add(row.file_path);
    }

    const files = await getUserUploadFiles(authId);
    for (const file of files) {
      if (!referencedPaths.has(file.relativePath)) {
        storageBytes += file.size;
      }
    }

    this.masterDatabase.updateUploadQuotaCounters(authId, fileCount, storageBytes);

    return { fileCount, storageBytes };
  }

  async backfillAllUsers(userDatabaseManager) {
    if (!userDatabaseManager) {
      logger.warn('UserDatabaseManager not available, skipping upload quota backfill');
      return;
    }

    const users = this.masterDatabase.getAllRegisteredAuthIds();
    let processed = 0;
    let errors = 0;
    let totalBytes = 0;

    for (const { auth_id: authId } of users) {
      try {
        const userDb = await userDatabaseManager.getUserDatabase(authId);
        const { storageBytes } = await this.recalculateUsage(authId, userDb);
        totalBytes += storageBytes;
        processed++;

        if (processed % 500 === 0) {
          logger.info('Upload quota backfill progress', { processed, total: users.length });
        }
      } catch (error) {
        errors++;
        logger.error('Upload quota backfill failed for user', error, { authId });
      } finally {
        userDatabaseManager.closeConnection(authId);
      }
    }

    logger.info('Upload quota backfill completed', {
      total: users.length,
      processed,
      errors,
      totalRetainedStorageMb: (totalBytes / (1024 * 1024)).toFixed(2),
    });
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export { UPLOAD_TIERS, formatBytes };

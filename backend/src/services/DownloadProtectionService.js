import { isDestructiveOperation } from '../config/destructiveDownloadOperations.mjs';

export const DOWNLOAD_PROTECTED_CODE = 'DOWNLOAD_PROTECTED';
export const DOWNLOAD_PROTECTED_MESSAGE = 'Download is protected';

export class DownloadProtectedError extends Error {
  /**
   * @param {string[]} blockedIds
   */
  constructor(blockedIds = []) {
    super(DOWNLOAD_PROTECTED_MESSAGE);
    this.name = 'DownloadProtectedError';
    this.code = DOWNLOAD_PROTECTED_CODE;
    this.blockedIds = blockedIds;
  }
}

export class DownloadProtectionService {
  /**
   * @param {import('bun:sqlite').Database} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * @param {Array<string|number>} [downloadIds] - when omitted, returns all protected IDs
   * @returns {Set<string>}
   */
  getProtectedSet(downloadIds) {
    if (downloadIds == null) {
      const rows = this.db.prepare('SELECT download_id FROM protected_downloads').all();
      return new Set(rows.map((row) => String(row.download_id)));
    }

    const ids = [...new Set(downloadIds.map((id) => String(id)).filter(Boolean))];
    if (ids.length === 0) {
      return new Set();
    }

    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT download_id FROM protected_downloads WHERE download_id IN (${placeholders})`)
      .all(...ids);

    return new Set(rows.map((row) => String(row.download_id)));
  }

  /**
   * @param {string|number} downloadId
   * @returns {boolean}
   */
  isProtected(downloadId) {
    if (downloadId == null || downloadId === '') {
      return false;
    }
    const row = this.db
      .prepare('SELECT 1 FROM protected_downloads WHERE download_id = ?')
      .get(String(downloadId));
    return Boolean(row);
  }

  /**
   * Protected download IDs (presence in table = protected).
   * @param {Array<string|number>} [downloadIds] - when omitted, returns all protected IDs
   * @returns {string[]}
   */
  getProtectedIds(downloadIds) {
    return [...this.getProtectedSet(downloadIds)];
  }

  /**
   * @param {Array<string|number>} downloadIds
   * @param {boolean} isProtected
   */
  setProtected(downloadIds, isProtected) {
    const ids = [...new Set(downloadIds.map((id) => String(id)).filter(Boolean))];
    if (ids.length === 0) {
      return;
    }

    const protectMany = this.db.transaction((entries) => {
      if (isProtected) {
        const insert = this.db.prepare(
          `
          INSERT OR IGNORE INTO protected_downloads (download_id, protected_at)
          VALUES (?, CURRENT_TIMESTAMP)
        `
        );
        for (const id of entries) {
          insert.run(id);
        }
        return;
      }

      const placeholders = entries.map(() => '?').join(',');
      this.db
        .prepare(`DELETE FROM protected_downloads WHERE download_id IN (${placeholders})`)
        .run(...entries);
    });

    protectMany(ids);
  }

  /**
   * @param {Array<string|number>} downloadIds
   * @returns {{ allowed: string[], blocked: string[] }}
   */
  partitionByProtection(downloadIds) {
    const ids = [...new Set(downloadIds.map((id) => String(id)).filter(Boolean))];
    if (ids.length === 0) {
      return { allowed: [], blocked: [] };
    }

    const protectedSet = this.getProtectedSet(ids);
    const allowed = [];
    const blocked = [];

    for (const id of ids) {
      if (protectedSet.has(id)) {
        blocked.push(id);
      } else {
        allowed.push(id);
      }
    }

    return { allowed, blocked };
  }

  /**
   * @param {string} operation
   * @param {Array<string|number>} downloadIds
   * @throws {DownloadProtectedError}
   */
  assertDestructiveAllowed(operation, downloadIds) {
    if (!isDestructiveOperation(operation)) {
      return;
    }

    const { blocked } = this.partitionByProtection(downloadIds);
    if (blocked.length > 0) {
      throw new DownloadProtectedError(blocked);
    }
  }
}

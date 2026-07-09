import {
  DownloadProtectionService,
  DownloadProtectedError,
} from '../services/DownloadProtectionService.js';
import { respondDownloadProtected } from '../utils/downloadProtectionResponse.js';

/**
 * Run a destructive-operation guard against protected downloads.
 * @param {import('bun:sqlite').Database} db
 * @param {string} operation
 * @param {Array<string|number>} downloadIds
 * @throws {DownloadProtectedError}
 */
export function assertDownloadsDestructiveAllowed(db, operation, downloadIds) {
  const service = new DownloadProtectionService(db);
  service.assertDestructiveAllowed(operation, downloadIds);
}

/**
 * Express helper: send 403 when protection blocks the operation.
 * @param {import('express').Response} res
 * @param {unknown} error
 * @returns {boolean} true if handled
 */
export function handleDownloadProtectedError(res, error) {
  if (error instanceof DownloadProtectedError) {
    respondDownloadProtected(res, error);
    return true;
  }
  return false;
}

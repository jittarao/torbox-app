import { readFileSync } from 'fs';
import {
  getUploadFilePath,
  fileExists,
  validateFilePathOwnership,
} from '../utils/fileStorage.js';
import { extractHashFromMagnet, extractInfoHashFromTorrentBuffer } from '../utils/torrentHash.js';

/**
 * Whether a failed upload error indicates TorBox already has the item.
 * @param {Object} upload
 * @returns {boolean}
 */
export function isDuplicateUploadFailure(upload) {
  const errorMessage = String(upload.error_message || '');
  return (
    /already\s+(queued|exists)/i.test(errorMessage) ||
    errorMessage.includes('DUPLICATE_ITEM') ||
    errorMessage.includes('This item already exists')
  );
}

/**
 * Extract expected infohash from a torrent upload when possible.
 * @param {Object} upload
 * @returns {Promise<string|null>}
 */
export async function getExpectedTorrentHash(upload) {
  if (upload.type !== 'torrent') return null;

  if (upload.upload_type === 'magnet' && upload.url) {
    return extractHashFromMagnet(upload.url);
  }

  if (upload.upload_type === 'file' && upload.file_path && upload.authId) {
    if (!validateFilePathOwnership(upload.authId, upload.file_path)) {
      return null;
    }

    if (!(await fileExists(upload.file_path))) {
      return null;
    }

    try {
      const absolutePath = getUploadFilePath(upload.file_path);
      return extractInfoHashFromTorrentBuffer(readFileSync(absolutePath));
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Match an upload against a pre-fetched TorBox mylist + getqueued list.
 * @param {Object} upload
 * @param {Array<Object>} torrents
 * @param {string|null} expectedHash
 * @returns {{ hash: string|null, torrentId: string|number|null, authId: string|null }}
 */
export function matchTorboxResource(upload, torrents, expectedHash) {
  let match = null;

  if (expectedHash) {
    const normalized = expectedHash.toLowerCase();
    match = torrents.find((item) => (item.hash || '').toLowerCase() === normalized) || null;
  }

  if (!match && upload.name) {
    match = torrents.find((item) => item.name === upload.name) || null;
  }

  return {
    hash: match?.hash ?? null,
    torrentId: match?.id ?? null,
    authId: match?.auth_id ?? null,
  };
}

/**
 * Mark an upload completed with TorBox result fields.
 * @param {Object} userDb
 * @param {number} uploadId
 * @param {{ hash: string|null, torrentId: string|number|null, authId: string|null }} resolved
 * @returns {{ changes: number }}
 */
export function completeUploadWithTorboxResult(userDb, uploadId, resolved) {
  return userDb.db
    .prepare(
      `
      UPDATE uploads
      SET status = 'completed',
          error_message = NULL,
          retry_count = 0,
          torbox_hash = ?,
          torbox_torrent_id = ?,
          torbox_auth_id = ?,
          next_attempt_at = NULL,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'failed'
    `
    )
    .run(resolved.hash, resolved.torrentId, resolved.authId, uploadId);
}

const UPLOAD_RETRY_SELECT_FIELDS = `
  id, type, upload_type, file_path, url, name, status, error_message
`;

/**
 * Before re-queuing failed uploads, complete duplicate-failure torrents that
 * already exist on TorBox. Fetches mylist + getqueued at most once.
 * @param {Object} params
 * @param {Array<Object>} params.failedUploads
 * @param {string} params.authId
 * @param {Object} params.userDb
 * @param {(authId: string) => Promise<import('../api/ApiClient.js').default>} params.getApiClient
 * @returns {Promise<{ completedIds: number[], toRequeue: Object[] }>}
 */
export async function splitRetriesByTorboxPresence({
  failedUploads,
  authId,
  userDb,
  getApiClient,
}) {
  const duplicateFailures = failedUploads.filter(isDuplicateUploadFailure);
  const nonDuplicates = failedUploads.filter((upload) => !isDuplicateUploadFailure(upload));

  if (duplicateFailures.length === 0) {
    return { completedIds: [], toRequeue: failedUploads };
  }

  const torrentDuplicates = duplicateFailures.filter((upload) => upload.type === 'torrent');
  let torrents = null;

  if (torrentDuplicates.length > 0) {
    const apiClient = await getApiClient(authId);
    torrents = await apiClient.getTorrents(true);
  }

  const completedIds = [];
  const unresolvedDuplicates = [];

  for (const upload of duplicateFailures) {
    if (upload.type !== 'torrent' || !torrents) {
      unresolvedDuplicates.push(upload);
      continue;
    }

    const expectedHash = await getExpectedTorrentHash({ ...upload, authId });
    const resolved = matchTorboxResource(upload, torrents, expectedHash);

    if (resolved.hash || resolved.torrentId != null) {
      const result = completeUploadWithTorboxResult(userDb, upload.id, resolved);
      if (result.changes > 0) {
        completedIds.push(upload.id);
      } else {
        unresolvedDuplicates.push(upload);
      }
    } else {
      unresolvedDuplicates.push(upload);
    }
  }

  return {
    completedIds,
    toRequeue: [...nonDuplicates, ...unresolvedDuplicates],
  };
}

export { UPLOAD_RETRY_SELECT_FIELDS };

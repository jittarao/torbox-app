import logger from '../utils/logger.js';
import { saveUploadFile, deleteUploadFile } from '../utils/fileStorage.js';
import { fetchNzbLink, looksLikeNzb } from '../utils/fetchNzbLink.js';
import { resolveUsenetUploadNames } from '../../../src/utils/nzbLinkName.js';

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid-url';
  }
}

/**
 * Turn a queued Usenet link into a stored NZB file named from Content-Disposition
 * or the final URL. When the prefetch fails, keep the link and replace only an
 * unsafe slot name so query strings and API keys are not sent to TorBox.
 *
 * @param {Object} upload
 * @param {{ db: { prepare: Function } }} userDb
 * @param {{ fetchNzbLink?: Function, fetchImpl?: Function, saveUploadFile?: Function, deleteUploadFile?: Function, adjustQuotaCounters?: Function, logger?: Object }} [deps]
 */
export async function materializeUsenetLinkUpload(upload, userDb, deps = {}) {
  if (!upload || upload.type !== 'usenet' || upload.upload_type !== 'link' || !upload.url) {
    return upload;
  }

  const log = deps.logger || logger;
  const fetchLink = deps.fetchNzbLink || fetchNzbLink;
  const saveFile = deps.saveUploadFile || saveUploadFile;
  const deleteFile = deps.deleteUploadFile || deleteUploadFile;

  let fetched = null;
  try {
    fetched = await fetchLink(upload.url, { fetchImpl: deps.fetchImpl });
  } catch (error) {
    log.warn('NZB link prefetch failed; submitting the link with a safe name', {
      uploadId: upload.id,
      host: safeHost(upload.url),
      errorMessage: error?.message,
    });
  }

  const usable = fetched && looksLikeNzb(fetched.body, fetched.contentType) ? fetched : null;
  const names = resolveUsenetUploadNames({
    sourceUrl: upload.url,
    finalUrl: usable?.finalUrl,
    contentDisposition: usable?.contentDisposition,
    existingName: upload.name,
  });

  if (!usable) {
    if (names.slotName !== upload.name && upload.id != null && userDb?.db) {
      userDb.db
        .prepare('UPDATE uploads SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(names.slotName, upload.id);
    }
    return { ...upload, name: names.slotName };
  }

  const saved = await saveFile(upload.authId, usable.body, names.fileName, 'usenet');
  const sizeBytes = saved.sizeBytes ?? usable.body.length;

  if (upload.id != null && userDb?.db) {
    try {
      userDb.db
        .prepare(
          `
          UPDATE uploads
          SET upload_type = 'file',
              file_path = ?,
              name = ?,
              file_size_bytes = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
        )
        .run(saved.relativePath, names.slotName, sizeBytes, upload.id);
    } catch (error) {
      await deleteFile(upload.authId, saved.relativePath).catch(() => {});
      throw error;
    }
  }

  if (typeof deps.adjustQuotaCounters === 'function' && sizeBytes > 0) {
    try {
      deps.adjustQuotaCounters(upload.authId, 1, sizeBytes);
    } catch (error) {
      log.warn('Failed to adjust upload quota after NZB prefetch', {
        uploadId: upload.id,
        errorMessage: error?.message,
      });
    }
  }

  return {
    ...upload,
    upload_type: 'file',
    file_path: saved.relativePath,
    name: names.slotName,
    nzbFilename: names.fileName,
    file_size_bytes: sizeBytes,
  };
}

import { getDownloadSelectionId } from '@/utils/downloadSelectionId';

/** Stable per-file identity for list merge / reconcile (id + size only). */
export function fileListSignature(files) {
  if (!files?.length) return '';
  return files.map((f) => `${f.id}:${f.size ?? 0}`).join('|');
}

/**
 * Strip files[] from a download row; keep fileCount + fileListSignature on the entity.
 * Full file metadata is stored in the expand-time side cache (filesByEntityKey).
 *
 * @param {object} row
 * @returns {{ slim: object, files: object[] | null }}
 */
export function slimRowForStorage(row) {
  const files = row.files;
  const hasFiles = Array.isArray(files) && files.length > 0;
  const fileCount = hasFiles ? files.length : (row.fileCount ?? row.file_count ?? 0);
  const signature = row.fileListSignature ?? (hasFiles ? fileListSignature(files) : '');

  const { files: _files, ...rest } = row;
  const slim = { ...rest, fileCount, fileListSignature: signature };
  return { slim, files: hasFiles ? files : null };
}

/** @param {object | null | undefined} row */
export function rowFileListSignature(row) {
  if (!row) return '';
  if (row.fileListSignature !== undefined) return row.fileListSignature;
  return fileListSignature(row.files);
}

/** @param {object | null | undefined} item */
export function getItemFileCount(item) {
  if (!item) return 0;
  if (item.fileCount != null) return item.fileCount;
  if (item.files?.length) return item.files.length;
  return item.file_count ?? 0;
}

/** True when a slim row has no files and its side-cache entry should be removed. */
export function shouldEvictFilesCache(slimRow) {
  if (!slimRow) return true;
  const count = slimRow.fileCount ?? slimRow.file_count ?? 0;
  return count === 0 && !slimRow.fileListSignature;
}

/**
 * Resolve full files[] for an item from the side cache (expand-time / action-time).
 *
 * @param {object | null | undefined} item
 * @param {Record<string, object[]>} [filesByEntityKey]
 * @param {string} [entityKeyOverride]
 */
export function resolveItemFiles(item, filesByEntityKey, entityKeyOverride) {
  if (!item) return [];
  const key = entityKeyOverride || getDownloadSelectionId(item);
  const cached = filesByEntityKey?.[key];
  if (cached) return cached;
  return item.files || [];
}

/**
 * Mutates `cache` when the entry for `key` must change. Returns true if mutated.
 *
 * @param {Record<string, object[]>} cache
 * @param {string} key
 * @param {object} slimRow
 * @param {object[] | null} files
 * @param {object | undefined} prevEntity
 * @param {object[] | undefined} prevCachedFiles
 */
export function applyFilesCacheEntry(cache, key, slimRow, files, prevEntity, prevCachedFiles) {
  if (files?.length) {
    const nextFiles =
      prevEntity?.fileListSignature === slimRow.fileListSignature && prevCachedFiles
        ? prevCachedFiles
        : files;
    if (cache[key] === nextFiles) return false;
    cache[key] = nextFiles;
    return true;
  }

  if (!shouldEvictFilesCache(slimRow)) return false;
  if (!(key in cache)) return false;
  delete cache[key];
  return true;
}

/**
 * @param {Record<string, object[]>} prevCache
 * @param {string} key
 * @param {object} slimRow
 * @param {object[] | null} files
 * @param {object | undefined} prevEntity
 * @param {object[] | undefined} prevCachedFiles
 * @returns {Record<string, object[]>}
 */
export function updateFilesCacheEntry(prevCache, key, slimRow, files, prevEntity, prevCachedFiles) {
  const nextCache = { ...prevCache };
  applyFilesCacheEntry(nextCache, key, slimRow, files, prevEntity, prevCachedFiles);
  return nextCache;
}

import path from 'path';
import { mkdir, writeFile, unlink, access, stat, readdir } from 'fs/promises';
import { constants } from 'fs';
import logger from './logger.js';

const UPLOAD_STORAGE_DIR = process.env.UPLOAD_STORAGE_DIR || '/app/data/uploads';

/**
 * Get the upload directory path for a user
 * @param {string} authId - User authentication ID
 * @returns {string} Directory path
 */
function getUserUploadDir(authId) {
  return path.join(UPLOAD_STORAGE_DIR, `user_${authId}`);
}

/**
 * Get the upload directory path for a specific type
 * @param {string} authId - User authentication ID
 * @param {string} type - Upload type (torrent, usenet, webdl)
 * @returns {string} Directory path
 */
function getTypeUploadDir(authId, type) {
  return path.join(getUserUploadDir(authId), type);
}

/**
 * Generate a safe filename from original filename
 * @param {string} originalFilename - Original filename
 * @returns {string} Safe filename
 */
function generateSafeFilename(originalFilename) {
  // Extract extension
  const ext = path.extname(originalFilename);
  // Generate unique filename with timestamp and random string
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const baseName = path.basename(originalFilename, ext);
  // Sanitize base name (remove special characters, limit length)
  const sanitized = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
  return `${sanitized}_${timestamp}_${random}${ext}`;
}

/**
 * Save an uploaded file to storage
 * @param {string} authId - User authentication ID
 * @param {Buffer|Uint8Array} fileBuffer - File buffer
 * @param {string} originalFilename - Original filename
 * @param {string} type - Upload type (torrent, usenet, webdl)
 * @returns {Promise<string>} File path relative to storage root
 */
export async function saveUploadFile(authId, fileBuffer, originalFilename, type) {
  try {
    // Ensure directories exist
    const typeDir = getTypeUploadDir(authId, type);
    await mkdir(typeDir, { recursive: true });

    // Generate safe filename
    const safeFilename = generateSafeFilename(originalFilename);
    const filePath = path.join(typeDir, safeFilename);

    // Write file
    await writeFile(filePath, fileBuffer);

    // Return relative path from storage root
    const relativePath = path.relative(UPLOAD_STORAGE_DIR, filePath);
    logger.info('File saved successfully', {
      authId,
      type,
      originalFilename,
      safeFilename,
      relativePath,
    });

    return relativePath;
  } catch (error) {
    logger.error('Error saving upload file', error, {
      authId,
      type,
      originalFilename,
    });
    throw error;
  }
}

/**
 * Delete an uploaded file from storage
 * @param {string} authId - User authentication ID (required for security)
 * @param {string} filePath - File path (relative to storage root or absolute)
 * @returns {Promise<void>}
 */
export async function deleteUploadFile(authId, filePath) {
  try {
    if (!authId) {
      throw new Error('authId is required for file deletion');
    }

    // Get the user's upload directory
    const userUploadDir = getUserUploadDir(authId);

    // Resolve the path to normalize it (handles .. and . components)
    // filePath is relative to UPLOAD_STORAGE_DIR (as returned by saveUploadFile)
    let resolvedPath;
    if (path.isAbsolute(filePath)) {
      resolvedPath = path.resolve(filePath);
    } else {
      // For relative paths, resolve from UPLOAD_STORAGE_DIR (not userUploadDir)
      // This matches how saveUploadFile returns paths and how getUserUploadFiles calculates them
      resolvedPath = path.resolve(UPLOAD_STORAGE_DIR, filePath);
    }

    // Security check: Ensure the resolved path is within the user's upload directory
    // Use path.resolve to normalize both paths for comparison
    const normalizedUserDir = path.resolve(userUploadDir);
    const normalizedResolvedPath = path.resolve(resolvedPath);

    // Use path.relative to check if the resolved path is within the user directory
    // If the relative path starts with '..', it means we're outside the directory
    const relativePath = path.relative(normalizedUserDir, normalizedResolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      logger.error('Path traversal attempt detected', {
        authId,
        filePath,
        resolvedPath: normalizedResolvedPath,
        userUploadDir: normalizedUserDir,
        relativePath,
      });
      throw new Error('Invalid file path: path must be within user upload directory');
    }

    // Check if file exists
    try {
      await access(normalizedResolvedPath, constants.F_OK);
    } catch {
      // File doesn't exist, that's okay
      logger.warn('File not found for deletion', {
        authId,
        filePath: normalizedResolvedPath,
      });
      return;
    }

    // Delete file
    await unlink(normalizedResolvedPath);
    logger.info('File deleted successfully', {
      authId,
      filePath: normalizedResolvedPath,
    });
  } catch (error) {
    logger.error('Error deleting upload file', error, { authId, filePath });
    // Don't throw - file deletion failure shouldn't break the flow
  }
}

/**
 * Get the absolute file path for an upload
 * @param {string} filePath - Relative file path from storage root
 * @returns {string} Absolute file path
 */
export function getUploadFilePath(filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(UPLOAD_STORAGE_DIR, filePath);
}

/**
 * Check if a file exists
 * @param {string} filePath - File path (relative to storage root or absolute)
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(filePath) {
  try {
    const absolutePath = getUploadFilePath(filePath);
    await access(absolutePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file stats (size and modification time)
 * @param {string} filePath - File path (relative to storage root or absolute)
 * @returns {Promise<{size: number, mtime: Date}|null>} File stats or null if not found
 */
export async function getFileStats(filePath) {
  try {
    const absolutePath = getUploadFilePath(filePath);
    const stats = await stat(absolutePath);
    return {
      size: stats.size,
      mtime: stats.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Calculate total size of all files in user's upload directory
 * @param {string} authId - User authentication ID
 * @returns {Promise<number>} Total size in bytes
 */
export async function calculateUserUploadDirSize(authId) {
  try {
    const userUploadDir = getUserUploadDir(authId);
    let totalSize = 0;

    // Recursively calculate size of all files
    async function calculateDirSize(dirPath) {
      try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            await calculateDirSize(fullPath);
          } else if (entry.isFile()) {
            try {
              const stats = await stat(fullPath);
              totalSize += stats.size;
            } catch {
              // File might have been deleted, skip it
            }
          }
        }
      } catch {
        // Directory might not exist or be inaccessible, skip it
      }
    }

    await calculateDirSize(userUploadDir);
    return totalSize;
  } catch (error) {
    logger.error('Error calculating user upload directory size', error, { authId });
    return 0;
  }
}

/**
 * Get all files in user's upload directory with their stats, sorted by oldest first
 * @param {string} authId - User authentication ID
 * @returns {Promise<Array<{relativePath: string, absolutePath: string, size: number, mtime: Date}>>} Array of file info
 */
export async function getUserUploadFiles(authId) {
  const files = [];

  async function scanDirectory(dirPath, baseDir) {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, baseDir);
        } else if (entry.isFile()) {
          try {
            const stats = await stat(fullPath);
            const relativePath = path.relative(baseDir, fullPath);
            files.push({
              relativePath,
              absolutePath: fullPath,
              size: stats.size,
              mtime: stats.mtime,
            });
          } catch {
            // File might have been deleted, skip it
          }
        }
      }
    } catch {
      // Directory might not exist or be inaccessible, skip it
    }
  }

  const userUploadDir = getUserUploadDir(authId);
  await scanDirectory(userUploadDir, UPLOAD_STORAGE_DIR);

  // Sort by modification time (oldest first)
  files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

  return files;
}

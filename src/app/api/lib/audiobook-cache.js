/**
 * Server-only: filesystem cache for audiobook chapter data.
 * Keyed by {id}-{file_id}. One JSON file per key.
 */

import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR_ENV = 'AUDIOBOOK_CACHE_DIR';
const DEFAULT_CACHE_DIR = '.audiobook-cache';

function getCacheDir() {
  if (process.env[CACHE_DIR_ENV]) {
    return process.env[CACHE_DIR_ENV];
  }
  return path.join(process.cwd(), DEFAULT_CACHE_DIR);
}

function cacheKey(id, fileId) {
  return `${id}-${fileId}`;
}

function safeFilename(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
}

/**
 * @param {string} id - Item id (torrent_id / usenet_id / web_id)
 * @param {string} fileId - File id
 * @returns {Promise<{ title: string, startSeconds: number }[] | null>}
 */
export async function getChapterCache(id, fileId) {
  const dir = getCacheDir();
  const key = cacheKey(id, fileId);
  const file = path.join(dir, safeFilename(key));
  try {
    const data = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed.chapters)) {
      return parsed.chapters;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {string} id
 * @param {string} fileId
 * @param {{ title: string, startSeconds: number }[]} chapters
 */
export async function setChapterCache(id, fileId, chapters) {
  const dir = getCacheDir();
  const key = cacheKey(id, fileId);
  const file = path.join(dir, safeFilename(key));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    file,
    JSON.stringify({ chapters, fetchedAt: new Date().toISOString() }),
    'utf8'
  );
}

/**
 * Server-only: download and cache ffprobe binary for chapter extraction.
 * Supports Windows and Linux. Uses async I/O only; safe to call from API routes.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';

const FFPROBE_RELEASE_TAG = 'autobuild-2026-02-21-13-00';
const FFPROBE_BASE_URL = `https://github.com/BtbN/FFmpeg-Builds/releases/download/${FFPROBE_RELEASE_TAG}`;

const WINDOWS_ASSET = 'ffmpeg-N-122924-g3be4545b67-win64-lgpl-shared.zip';
const LINUX_ASSET = 'ffmpeg-N-122924-g3be4545b67-linux64-lgpl-shared.tar.xz';

/** @type {Promise<string> | null} */
let ffprobePathPromise = null;

function getCacheDir() {
  if (process.env.FFPROBE_AUTO_DIR) {
    return process.env.FFPROBE_AUTO_DIR;
  }
  const projectRoot = process.cwd();
  return path.join(projectRoot, '.ffprobe');
}

function getPathCacheFile() {
  return path.join(getCacheDir(), 'path.json');
}

async function readCachedPath() {
  try {
    const cacheFile = getPathCacheFile();
    const data = await fs.readFile(cacheFile, 'utf8');
    const { path: cachedPath, platform } = JSON.parse(data);
    if (cachedPath && platform === process.platform) {
      try {
        await fs.access(cachedPath);
        return cachedPath;
      } catch {
        // cached path no longer exists
      }
    }
  } catch {
    // no cache or invalid
  }
  return null;
}

async function writeCachedPath(ffprobePath) {
  const cacheFile = getPathCacheFile();
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  await fs.writeFile(
    cacheFile,
    JSON.stringify({ path: ffprobePath, platform: process.platform }),
    'utf8'
  );
}

/**
 * @param {string} url - URL to download
 * @param {string} extension - File extension for saved file (e.g. '.zip' or '.tar.xz') so redirects don't change format
 */
function downloadFile(url, extension) {
  return new Promise((resolve, reject) => {
    const file = path.join(
      os.tmpdir(),
      `ffprobe-dl-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const dest = extension
      ? `${file}${extension.startsWith('.') ? extension : '.' + extension}`
      : url.endsWith('.zip')
        ? `${file}.zip`
        : `${file}.tar.xz`;
    const stream = createWriteStream(dest);
    stream.on('error', (err) => {
      stream.close();
      fs.unlink(dest).catch(() => {});
      reject(err);
    });
    https
      .get(url, { headers: { 'User-Agent': 'TorBox-Manager/1.0' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          const redirect = res.headers.location;
          if (redirect) {
            stream.close();
            fs.unlink(dest).catch(() => {});
            res.destroy();
            downloadFile(redirect, extension).then(resolve).catch(reject);
            return;
          }
        }
        if (res.statusCode !== 200) {
          stream.close();
          fs.unlink(dest).catch(() => {});
          res.destroy();
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(stream);
        stream.on('finish', () => {
          stream.close();
          resolve(dest);
        });
      })
      .on('error', (err) => {
        stream.close();
        fs.unlink(dest).catch(() => {});
        reject(err);
      });
  });
}

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'pipe', ...opts });
    let stderr = '';
    proc.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `Exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function extractWindows(zipPath, destDir) {
  const psScript = `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`;
  await runCommand('powershell', ['-NoProfile', '-Command', psScript]);
}

async function extractLinux(tarPath, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  await runCommand('tar', ['-xJf', tarPath, '-C', destDir]);
}

async function findFfprobeInDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const sub = path.join(dir, e.name);
    const winFfprobe = path.join(sub, 'bin', 'ffprobe.exe');
    const linuxFfprobe = path.join(sub, 'bin', 'ffprobe');
    try {
      await fs.access(winFfprobe);
      return winFfprobe;
    } catch {
      try {
        await fs.access(linuxFfprobe);
        return linuxFfprobe;
      } catch {
        const nested = await findFfprobeInDir(sub);
        if (nested) return nested;
      }
    }
  }
  return null;
}

async function bootstrapFfprobe() {
  const cacheDir = getCacheDir();
  const platform = process.platform;
  let archivePath;

  if (platform === 'win32') {
    const url = `${FFPROBE_BASE_URL}/${WINDOWS_ASSET}`;
    archivePath = await downloadFile(url, '.zip');
    await extractWindows(archivePath, cacheDir);
  } else if (platform === 'linux') {
    const url = `${FFPROBE_BASE_URL}/${LINUX_ASSET}`;
    archivePath = await downloadFile(url, '.tar.xz');
    await extractLinux(archivePath, cacheDir);
  } else {
    throw new Error(
      `Unsupported platform for ffprobe bootstrap: ${platform}. Set FFPROBE_PATH to your ffprobe binary.`
    );
  }

  const ffprobePath = await findFfprobeInDir(cacheDir);
  if (!ffprobePath) {
    throw new Error('ffprobe binary not found after extraction');
  }

  try {
    if (archivePath) await fs.unlink(archivePath).catch(() => {});
  } catch {
    // ignore
  }

  await writeCachedPath(ffprobePath);
  return ffprobePath;
}

/**
 * Returns the path to the ffprobe executable. Downloads and extracts on first use if not cached.
 * @returns {Promise<string>}
 */
export async function getFfprobePath() {
  if (process.env.FFPROBE_PATH) {
    try {
      await fs.access(process.env.FFPROBE_PATH);
      return process.env.FFPROBE_PATH;
    } catch {
      // env set but invalid, fall through to cache/bootstrap
    }
  }

  if (!ffprobePathPromise) {
    ffprobePathPromise = (async () => {
      const cached = await readCachedPath();
      if (cached) return cached;
      return bootstrapFfprobe();
    })().catch((err) => {
      ffprobePathPromise = null;
      throw err;
    });
  }
  return ffprobePathPromise;
}

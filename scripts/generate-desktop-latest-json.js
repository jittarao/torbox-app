#!/usr/bin/env bun
/**
 * Build the Tauri updater manifest (latest.json) from staged release artifacts.
 *
 * Usage:
 *   RELEASE_TAG=v0.1.25 GITHUB_REPOSITORY=owner/repo \
 *     bun scripts/generate-desktop-latest-json.js path/to/staged/files
 *
 * Expects updater bundles (not installers):
 *   - macOS: *.app.tar.gz (+ optional *.app.tar.gz.sig)
 *   - Windows: *.nsis.zip (+ optional *.nsis.zip.sig)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, join } from 'path';

const assetsDir = process.argv[2];
if (!assetsDir) {
  console.error('Usage: bun scripts/generate-desktop-latest-json.js <assets-dir>');
  process.exit(1);
}

const repo = process.env.GITHUB_REPOSITORY || 'jittarao/torbox-app';
const tag = process.env.RELEASE_TAG || `v${readDesktopVersion()}`;
const version = tag.replace(/^v/, '');
const notes = process.env.RELEASE_NOTES || `TorBox Manager desktop ${version}`;

function readDesktopVersion() {
  const confPath = join(import.meta.dir, '..', 'src-tauri', 'tauri.conf.json');
  return JSON.parse(readFileSync(confPath, 'utf8')).version;
}

function listFiles(dir) {
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isFile())
    .map((name) => join(dir, name));
}

function readSignature(filePath) {
  const sigPath = `${filePath}.sig`;
  try {
    return readFileSync(sigPath, 'utf8').trim();
  } catch {
    return null;
  }
}

function releaseUrl(filePath) {
  const fileName = basename(filePath);
  return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`;
}

function detectMacPlatform(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('aarch64') || lower.includes('arm64')) {
    return 'darwin-aarch64';
  }
  if (lower.includes('x64') || lower.includes('x86_64') || lower.includes('intel')) {
    return 'darwin-x86_64';
  }
  return 'darwin-aarch64';
}

function buildPlatforms(files) {
  const platforms = {};

  for (const filePath of files) {
    const fileName = basename(filePath);

    if (!fileName.endsWith('.app.tar.gz') && !fileName.endsWith('.nsis.zip')) {
      continue;
    }

    const signature = readSignature(filePath);
    if (!signature) {
      console.error(
        `warning: missing signature for ${fileName}; updater will not verify until signed`
      );
      continue;
    }

    let platformKey = null;
    if (fileName.endsWith('.app.tar.gz')) {
      platformKey = detectMacPlatform(fileName);
    } else if (fileName.endsWith('.nsis.zip')) {
      platformKey = 'windows-x86_64';
    }

    if (!platformKey) {
      continue;
    }

    platforms[platformKey] = {
      signature,
      url: releaseUrl(filePath),
    };
  }

  return platforms;
}

const platforms = buildPlatforms(listFiles(assetsDir));

if (Object.keys(platforms).length === 0) {
  console.error('No signed updater artifacts found (.app.tar.gz.sig / .nsis.zip.sig)');
  process.exit(1);
}

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms,
};

console.log(JSON.stringify(manifest, null, 2));

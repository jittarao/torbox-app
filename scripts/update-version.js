#!/usr/bin/env bun
/**
 * Bump or set the app version across package.json files.
 *
 * Usage:
 *   bun scripts/update-version.js              # print current version
 *   bun scripts/update-version.js patch        # 0.1.9 -> 0.1.10
 *   bun scripts/update-version.js minor        # 0.1.9 -> 0.2.0
 *   bun scripts/update-version.js major        # 0.1.9 -> 1.0.0
 *   bun scripts/update-version.js 0.1.9        # set exact version
 *   bun scripts/update-version.js set 0.1.9    # set exact version
 *
 * Updates: package.json and backend/package.json (Bun lockfiles do not store app version).
 * NEXT_PUBLIC_TORBOX_MANAGER_VERSION is injected from root package.json at build time.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..');

const PACKAGE_FILES = [join(ROOT, 'package.json'), join(ROOT, 'backend', 'package.json')];

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function parseVersion(version) {
  if (!SEMVER_RE.test(version)) {
    throw new Error(`Invalid semver (expected major.minor.patch): ${version}`);
  }
  return version.split('.').map(Number);
}

function formatVersion([major, minor, patch]) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(current, type) {
  const parts = parseVersion(current);
  switch (type) {
    case 'patch':
      return formatVersion([parts[0], parts[1], parts[2] + 1]);
    case 'minor':
      return formatVersion([parts[0], parts[1] + 1, 0]);
    case 'major':
      return formatVersion([parts[0] + 1, 0, 0]);
    default:
      throw new Error(`Unknown bump type: ${type}`);
  }
}

function getCurrentVersion() {
  return readJson(PACKAGE_FILES[0]).version;
}

function updatePackageVersion(filePath, version) {
  const pkg = readJson(filePath);
  pkg.version = version;
  writeJson(filePath, pkg);
}

function resolveTargetVersion(args) {
  const [first, second] = args;

  if (!first) {
    return null;
  }

  if (['patch', 'minor', 'major'].includes(first)) {
    return bumpVersion(getCurrentVersion(), first);
  }

  if (first === 'set' && second) {
    parseVersion(second);
    return second;
  }

  parseVersion(first);
  return first;
}

function applyVersion(version) {
  for (const file of PACKAGE_FILES) {
    updatePackageVersion(file, version);
  }
}

const target = resolveTargetVersion(process.argv.slice(2));

if (!target) {
  console.log(getCurrentVersion());
  process.exit(0);
}

const previous = getCurrentVersion();
applyVersion(target);
console.log(`Version updated: ${previous} -> ${target}`);

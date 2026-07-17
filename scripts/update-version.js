#!/usr/bin/env bun
/**
 * Bump or set app versions for the hosted web app and/or the Tauri desktop shell.
 *
 * The web app (Next.js + backend) and desktop shell version independently:
 * - Web: frequent deploys to tbm.tools; drives User-Agent and NEXT_PUBLIC_TORBOX_MANAGER_VERSION.
 * - Desktop: bump only when shipping new installers (Rust IPC, tray, updater, etc.).
 *
 * Usage:
 *   bun scripts/update-version.js                         # print web + desktop versions
 *   bun scripts/update-version.js patch                   # bump web patch
 *   bun scripts/update-version.js patch --desktop         # bump desktop patch
 *   bun scripts/update-version.js patch --all             # bump both
 *   bun scripts/update-version.js minor|major [--scope]   # same scopes as patch
 *   bun scripts/update-version.js set 0.1.9 [--scope]     # set exact version
 *   bun scripts/update-version.js 0.1.9 [--scope]         # set exact version
 *
 * Scopes: default = web only; --desktop = Tauri only; --all = web + desktop together.
 *
 * Web updates: package.json, backend/package.json.
 * Desktop updates: src-tauri/Cargo.toml, src-tauri/tauri.conf.json.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..');

const WEB_PACKAGE_FILES = [join(ROOT, 'package.json'), join(ROOT, 'backend', 'package.json')];
const TAURI_CARGO = join(ROOT, 'src-tauri', 'Cargo.toml');
const TAURI_CONF = join(ROOT, 'src-tauri', 'tauri.conf.json');

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const BUMP_TYPES = new Set(['patch', 'minor', 'major']);
const SCOPES = new Set(['web', 'desktop', 'all']);

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

function getWebVersion() {
  return readJson(WEB_PACKAGE_FILES[0]).version;
}

function getDesktopVersion() {
  return readJson(TAURI_CONF).version;
}

function updatePackageVersion(filePath, version) {
  const pkg = readJson(filePath);
  pkg.version = version;
  writeJson(filePath, pkg);
}

function updateWebVersion(version) {
  for (const file of WEB_PACKAGE_FILES) {
    updatePackageVersion(file, version);
  }
}

function updateTauriCargo(version) {
  const raw = readFileSync(TAURI_CARGO, 'utf8');
  const next = raw.replace(/^version = ".*"$/m, `version = "${version}"`);
  writeFileSync(TAURI_CARGO, next);
}

function updateTauriConf(version) {
  const conf = readJson(TAURI_CONF);
  conf.version = version;
  writeJson(TAURI_CONF, conf);
}

function updateDesktopVersion(version) {
  updateTauriCargo(version);
  updateTauriConf(version);
}

function parseArgs(argv) {
  const flags = new Set();
  const positional = [];

  for (const arg of argv) {
    if (arg === '--desktop') {
      flags.add('desktop');
    } else if (arg === '--all') {
      flags.add('all');
    } else if (arg === '--web') {
      flags.add('web');
    } else {
      positional.push(arg);
    }
  }

  let scope = 'web';
  if (flags.has('all')) {
    scope = 'all';
  } else if (flags.has('desktop')) {
    scope = 'desktop';
  } else if (flags.has('web')) {
    scope = 'web';
  }

  if (!SCOPES.has(scope)) {
    throw new Error(`Unknown scope: ${scope}`);
  }

  return { positional, scope };
}

function resolveTargetVersion(positional, scope) {
  const [first, second] = positional;

  if (!first) {
    return null;
  }

  if (BUMP_TYPES.has(first)) {
    const current = scope === 'desktop' ? getDesktopVersion() : getWebVersion();
    return bumpVersion(current, first);
  }

  const explicit = first === 'set' ? second : first;
  if (!explicit) {
    throw new Error('Missing version. Example: bun scripts/update-version.js set 0.1.9');
  }

  parseVersion(explicit);
  return explicit;
}

function printVersions() {
  console.log(`web: ${getWebVersion()}`);
  console.log(`desktop: ${getDesktopVersion()}`);
}

function applyScopedVersion(scope, version) {
  const previous = {
    web: getWebVersion(),
    desktop: getDesktopVersion(),
  };

  if (scope === 'web' || scope === 'all') {
    updateWebVersion(version);
  }
  if (scope === 'desktop' || scope === 'all') {
    updateDesktopVersion(version);
  }

  const lines = [];
  if (scope === 'web' || scope === 'all') {
    lines.push(`web: ${previous.web} -> ${getWebVersion()}`);
  }
  if (scope === 'desktop' || scope === 'all') {
    lines.push(`desktop: ${previous.desktop} -> ${getDesktopVersion()}`);
  }

  console.log(`Version updated (${scope}):\n${lines.map((line) => `  ${line}`).join('\n')}`);
}

const { positional, scope } = parseArgs(process.argv.slice(2));
const target = resolveTargetVersion(positional, scope);

if (!target) {
  printVersions();
  process.exit(0);
}

applyScopedVersion(scope, target);

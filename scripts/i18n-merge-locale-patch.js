#!/usr/bin/env bun
/**
 * Deep-merge a patch JSON file into a locale JSON file under src/i18n/messages/.
 *
 * This is useful when you've generated or translated a batch of missing keys
 * for a locale and want to merge them into the existing delta file without
 * manually editing the full file.
 *
 * Usage:
 *   bun scripts/i18n-merge-locale-patch.js <locale> <patch.json>
 *
 * Example:
 *   bun scripts/i18n-merge-locale-patch.js de /tmp/de_patch.json
 *
 * The script reads the existing locale file, deep-merges the patch on top,
 * re-sorts keys alphabetically for consistent ordering, and writes back.
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT = path.join(import.meta.dir, '..');
const MESSAGES_DIR = path.join(ROOT, 'src/i18n/messages');

const locale = process.argv[2];
const patchFile = process.argv[3];

if (!locale || !patchFile) {
  console.error('Usage: bun scripts/i18n-merge-locale-patch.js <locale> <patch.json>');
  process.exit(1);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (isPlainObject(source[key])) {
      if (!isPlainObject(target[key])) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

function sortKeys(obj) {
  if (!isPlainObject(obj)) return obj;
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

const localePath = path.join(MESSAGES_DIR, `${locale}.json`);

const existing = JSON.parse(readFileSync(localePath, 'utf8'));
const patch = JSON.parse(readFileSync(patchFile, 'utf8'));

deepMerge(existing, patch);

const sorted = sortKeys(existing);
writeFileSync(localePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

console.log(`✓ Merged ${patchFile} into ${locale}.json`);

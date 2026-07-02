#!/usr/bin/env bun
/**
 * Sort all keys recursively in every locale JSON file under
 * src/i18n/messages/ and write them back.
 *
 * This keeps the files in a consistent order regardless of how
 * keys are added or merged, making diffs easier to review.
 *
 * Usage:
 *   bun scripts/i18n-sort-locale-files.js
 *   bun scripts/i18n-sort-locale-files.js --check   # exit 1 if any file would change
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT = path.join(import.meta.dir, '..');
const MESSAGES_DIR = path.join(ROOT, 'src/i18n/messages');
const LOCALES = ['en', 'de', 'es', 'fr', 'ja', 'pl'];
const CHECK_ONLY = process.argv.includes('--check');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sortKeys(obj) {
  if (!isPlainObject(obj)) return obj;
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

let failed = false;

for (const locale of LOCALES) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const raw = readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const sorted = sortKeys(data);
  const formatted = `${JSON.stringify(sorted, null, 2)}\n`;

  if (CHECK_ONLY) {
    if (formatted !== raw) {
      console.error(`${locale}.json is not sorted — run bun scripts/i18n-sort-locale-files.js`);
      failed = true;
    } else {
      console.log(`${locale}.json OK`);
    }
    continue;
  }

  writeFileSync(filePath, formatted, 'utf8');
  console.log(`Sorted ${locale}.json`);
}

if (failed) process.exit(1);

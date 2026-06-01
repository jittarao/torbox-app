#!/usr/bin/env bun
/**
 * Prune locale JSON files to delta-only overrides (values that differ from en.json).
 * Usage:
 *   bun scripts/i18n-prune-locale-deltas.js          # rewrite locale files
 *   bun scripts/i18n-prune-locale-deltas.js --check   # exit 1 if any file has redundant keys
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT = path.join(import.meta.dir, '..');
const MESSAGES_DIR = path.join(ROOT, 'src/i18n/messages');
const LOCALES = ['de', 'es', 'fr', 'ja', 'pl'];
const CHECK_ONLY = process.argv.includes('--check');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pruneDelta(base, locale) {
  if (typeof base === 'string' && typeof locale === 'string') {
    return base === locale ? undefined : locale;
  }

  if (Array.isArray(base) && Array.isArray(locale)) {
    return JSON.stringify(base) === JSON.stringify(locale) ? undefined : locale;
  }

  if (!isPlainObject(base) || !isPlainObject(locale)) {
    return JSON.stringify(base) === JSON.stringify(locale) ? undefined : locale;
  }

  const out = {};
  for (const key of Object.keys(locale)) {
    if (!(key in base)) {
      continue;
    }
    const child = pruneDelta(base[key], locale[key]);
    if (child !== undefined) {
      out[key] = child;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function countLeaves(obj) {
  if (typeof obj === 'string') return 1;
  if (!isPlainObject(obj)) return 1;
  return Object.values(obj).reduce((sum, v) => sum + countLeaves(v), 0);
}

const en = JSON.parse(readFileSync(path.join(MESSAGES_DIR, 'en.json'), 'utf8'));
let failed = false;

for (const locale of LOCALES) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const current = JSON.parse(readFileSync(filePath, 'utf8'));
  const delta = pruneDelta(en, current) || {};
  const redundantLeaves = countLeaves(current) - countLeaves(delta);

  if (CHECK_ONLY) {
    if (redundantLeaves > 0) {
      console.error(
        `${locale}.json has ~${redundantLeaves} keys matching en.json — run bun scripts/i18n-prune-locale-deltas.js`
      );
      failed = true;
    } else {
      console.log(`${locale}.json OK (delta-only)`);
    }
    continue;
  }

  writeFileSync(filePath, `${JSON.stringify(delta, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${locale}.json (${countLeaves(delta)} leaf keys, pruned ~${redundantLeaves})`);
}

if (failed) {
  process.exit(1);
}

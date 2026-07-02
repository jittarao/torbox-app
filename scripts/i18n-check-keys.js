#!/usr/bin/env bun
/**
 * Compare src/i18n/messages/{locale}.json against en.json (the reference) and
 * report missing and extra keys in a structured format.
 *
 * Missing keys  : keys present in en.json but absent in the locale file
 *                 (locale files are delta-only, so any en key not overridden
 *                 is implicitly inherited — only report en leaves that have
 *                 no corresponding path in the locale tree).
 * Extra keys    : keys present in the locale file but absent from en.json
 *                 (stale/orphaned translations that should be removed).
 *
 * Usage:
 *   bun scripts/i18n-check-keys.js                # human report, exit 1 on issues
 *   bun scripts/i18n-check-keys.js --json         # machine-readable JSON output
 *   bun scripts/i18n-check-keys.js --quiet        # only report locales with issues
 */

import { readFileSync } from 'fs';
import path from 'path';

const ROOT = path.join(import.meta.dir, '..');
const MESSAGES_DIR = path.join(ROOT, 'src/i18n/messages');
const LOCALES = ['de', 'es', 'fr', 'ja', 'pl'];

const JSON_OUT = process.argv.includes('--json');
const QUIET = process.argv.includes('--quiet');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Walk a nested object and yield [path, leaf] pairs.
 * Arrays and non-plain-object values are treated as leaves.
 */
function* walkLeaves(obj, prefix = []) {
  if (!isPlainObject(obj)) {
    yield [prefix.join('.'), obj];
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    yield* walkLeaves(value, [...prefix, key]);
  }
}

function keyPaths(obj, prefix = []) {
  if (!isPlainObject(obj)) return [prefix.join('.')];
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    out.push(...keyPaths(value, [...prefix, key]));
  }
  return out;
}

function loadJson(locale) {
  return JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'));
}

function compare(reference, locale) {
  const refKeys = new Set(keyPaths(reference));
  const localeKeys = new Set(keyPaths(locale));

  const missing = [...refKeys].filter((k) => !localeKeys.has(k)).sort();
  // Extra: keys present in locale but not in reference.
  // For delta-only files, this means orphan keys that don't exist in en.json.
  const extra = [...localeKeys].filter((k) => !refKeys.has(k)).sort();

  return { missing, extra };
}

const en = loadJson('en');

const report = {};
let hasIssues = false;

for (const locale of LOCALES) {
  const localeData = loadJson(locale);
  const { missing, extra } = compare(en, localeData);

  // For delta-only files, "missing" en keys are EXPECTED (inherited from en).
  // So we only flag them if the locale is NOT delta-only. We treat all locale
  // files as delta-only per repo convention: "missing" keys are informational.
  // We surface missing as "inheritable" (informational) and extra as "stale".

  if (missing.length === 0 && extra.length === 0) {
    report[locale] = { missing: [], extra: [], deltaOnly: true };
    continue;
  }

  hasIssues = true;
  report[locale] = {
    missing,
    extra,
    missingCount: missing.length,
    extraCount: extra.length,
  };
}

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const locale of LOCALES) {
    const r = report[locale];
    if (QUIET && r.missingCount === 0 && r.extraCount === 0) continue;

    console.log(`\n=== ${locale}.json ===`);
    if (r.missing.length > 0) {
      console.log(`  [missing] ${r.missing.length} key(s) present in en.json but not in ${locale}.json`);
      console.log('  (delta-only convention: these inherit en.json values; override only if translating)');
      for (const k of r.missing) console.log(`    - ${k}`);
    } else {
      console.log('  [missing] none');
    }
    if (r.extra.length > 0) {
      console.log(`  [extra] ${r.extra.length} key(s) present in ${locale}.json but not in en.json — STALE, remove them`);
      for (const k of r.extra) console.log(`    - ${k}`);
    } else {
      console.log('  [extra] none');
    }
  }

  console.log('\nSummary:');
  for (const locale of LOCALES) {
    const r = report[locale];
    console.log(
      `  ${locale}: missing=${r.missing.length} extra=${r.extra.length}` +
        (r.missing.length + r.extra.length === 0 ? ' (clean)' : ''),
    );
  }
}

if (hasIssues && [...LOCALES].some((l) => report[l].extra.length > 0)) {
  // Only exit non-zero when there are stale "extra" keys that must be fixed.
  process.exit(1);
}
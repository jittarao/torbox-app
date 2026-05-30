import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';

const ROOT = path.join(import.meta.dir, '..', '..');
const MESSAGES_DIR = path.join(ROOT, 'src/i18n/messages');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pruneDelta(base, locale) {
  if (typeof base === 'string' && typeof locale === 'string') {
    return base === locale ? undefined : locale;
  }
  if (!isPlainObject(base) || !isPlainObject(locale)) {
    return JSON.stringify(base) === JSON.stringify(locale) ? undefined : locale;
  }
  const out = {};
  for (const key of Object.keys(locale)) {
    if (!(key in base)) {
      out[key] = locale[key];
      continue;
    }
    const child = pruneDelta(base[key], locale[key]);
    if (child !== undefined) out[key] = child;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function hasRedundantKeys(base, locale) {
  if (typeof base === 'string' && typeof locale === 'string') {
    return base === locale;
  }
  if (!isPlainObject(base) || !isPlainObject(locale)) return false;
  for (const key of Object.keys(locale)) {
    if (!(key in base)) return false;
    if (hasRedundantKeys(base[key], locale[key])) return true;
  }
  return false;
}

describe('i18n locale deltas', () => {
  const en = JSON.parse(readFileSync(path.join(MESSAGES_DIR, 'en.json'), 'utf8'));

  test('non-English locale files contain no keys identical to en', () => {
    for (const locale of ['de', 'es', 'fr', 'ja', 'pl']) {
      const data = JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'));
      expect(hasRedundantKeys(en, data)).toBe(false);
    }
  });

  test('pruneDelta removes English-identical leaves', () => {
    const base = { a: 'hello', b: { c: 'same', d: 'diff' } };
    const locale = { a: 'hello', b: { c: 'same', d: 'anders' } };
    expect(pruneDelta(base, locale)).toEqual({ b: { d: 'anders' } });
  });
});

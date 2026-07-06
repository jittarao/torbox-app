import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import {
  findOrphanKeys,
  findPendingKeys,
  findRedundantKeys,
  pruneDelta,
} from '../i18n/lib/delta.js';
import {
  extractSimplePlaceholders,
  validateIcuSyntax,
  validatePlaceholders,
} from '../i18n/lib/icu.js';
import { planTranslations } from '../i18n/lib/translate.js';
import { verifyLocales } from '../i18n/lib/verify.js';
import { isAdminKey } from '../i18n/lib/constants.js';

const ROOT = path.join(import.meta.dir, '..', '..');
const MESSAGES_DIR = path.join(ROOT, 'src/i18n/messages');

describe('i18n delta', () => {
  test('pruneDelta removes English-identical leaves', () => {
    const base = { a: 'hello', b: { c: 'same', d: 'diff' } };
    const locale = { a: 'hello', b: { c: 'same', d: 'anders' } };
    expect(pruneDelta(base, locale)).toEqual({ b: { d: 'anders' } });
  });

  test('findRedundantKeys detects identical leaves', () => {
    const base = { a: 'hello', b: { c: 'same', d: 'diff' } };
    const locale = { a: 'hello', b: { c: 'same', d: 'anders' } };
    expect(findRedundantKeys(base, locale)).toEqual(['a', 'b.c']);
  });

  test('findOrphanKeys detects stale keys', () => {
    const base = { a: 'hello' };
    const locale = { a: 'hello', stale: 'x' };
    expect(findOrphanKeys(base, locale)).toEqual(['stale']);
  });

  test('findPendingKeys excludes Admin keys', () => {
    const base = { Admin: { title: 'Admin' }, App: { title: 'App' } };
    const locale = {};
    expect(findPendingKeys(base, locale, { exclude: isAdminKey })).toEqual(['App.title']);
  });
});

describe('i18n ICU', () => {
  test('extractSimplePlaceholders ignores ICU blocks', () => {
    const text = '{count, plural, one {# tag} other {# tags}} for {name}';
    expect(extractSimplePlaceholders(text)).toEqual(['name']);
  });

  test('validateIcuSyntax accepts valid plural', () => {
    expect(validateIcuSyntax('{count, plural, one {# item} other {# items}}', 'k')).toBeNull();
  });

  test('validateIcuSyntax rejects invalid ICU', () => {
    expect(validateIcuSyntax('{count, plural, one {#', 'k')).toContain('invalid ICU');
  });

  test('validatePlaceholders detects missing vars', () => {
    const error = validatePlaceholders('Hello {name}', 'Hola', 'k');
    expect(error).not.toBeNull();
    expect(error).toContain('missing placeholder');
  });
});

describe('i18n repo invariants', () => {
  const en = JSON.parse(readFileSync(path.join(MESSAGES_DIR, 'en.json'), 'utf8'));

  test('non-English locale files contain no keys identical to en', () => {
    for (const locale of ['de', 'es', 'fr', 'ja', 'pl']) {
      const data = JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'));
      expect(findRedundantKeys(en, data)).toEqual([]);
    }
  });

  test('verifyLocales passes on committed locale files', () => {
    expect(verifyLocales().ok).toBe(true);
  });
});

describe('i18n translate', () => {
  test('plan excludes Admin keys', () => {
    const plan = planTranslations({ locales: ['de'] });
    const keys = Object.keys(plan.pending.de || {});
    expect(keys.some((key) => key.startsWith('Admin.'))).toBe(false);
  });
});

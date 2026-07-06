import { ALL_LOCALES, DEFAULT_LOCALE, TARGET_LOCALES, isAdminKey } from './constants.js';
import { findOrphanKeys, findRedundantKeys } from './delta.js';
import { validateStringLeaf } from './icu.js';
import { isSorted, loadAllLocales, readLocale } from './io.js';
import { getValueAtPath, isPlainObject, walkLeaves } from './tree.js';

export function verifyLocales({ locales = TARGET_LOCALES } = {}) {
  const errors = [];
  const en = readLocale(DEFAULT_LOCALE).data;

  for (const locale of ALL_LOCALES) {
    let data;
    let raw;
    try {
      ({ data, raw } = readLocale(locale));
    } catch (error) {
      errors.push(`${locale}.json: invalid JSON — ${error.message}`);
      continue;
    }

    if (!isSorted(raw, data)) {
      errors.push(`${locale}.json: keys are not sorted — run bun i18n:sync`);
    }

    if (locale === DEFAULT_LOCALE) continue;

    for (const orphan of findOrphanKeys(en, data)) {
      errors.push(`${locale}.json: orphan key "${orphan}" not in en.json`);
    }

    for (const redundant of findRedundantKeys(en, data)) {
      if (redundant) {
        errors.push(`${locale}.json: redundant key "${redundant}" identical to en.json`);
      }
    }

    for (const [keyPath, value] of walkLeaves(data)) {
      if (isAdminKey(keyPath)) {
        errors.push(`${locale}.json: Admin key "${keyPath}" must not appear in locale deltas`);
        continue;
      }

      const english = getValueAtPath(en, keyPath);
      if (english === undefined) continue;

      if (typeof value === 'string' && typeof english === 'string') {
        errors.push(...validateStringLeaf(english, value, `${locale}.${keyPath}`));
      } else if (isPlainObject(value) !== isPlainObject(english)) {
        errors.push(`${locale}.${keyPath}: structure mismatch with en.json`);
      }
    }
  }

  const pending = {};
  for (const locale of locales) {
    const { data } = readLocale(locale);
    const localeKeys = new Set([...walkLeaves(data)].map(([key]) => key));
    const missing = [];
    for (const [keyPath, english] of walkLeaves(en)) {
      if (isAdminKey(keyPath)) continue;
      if (localeKeys.has(keyPath)) continue;
      missing.push(keyPath);
    }
    if (missing.length > 0) pending[locale] = missing.length;
  }

  return { ok: errors.length === 0, errors, pending };
}

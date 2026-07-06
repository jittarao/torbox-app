import { DEFAULT_LOCALE, TARGET_LOCALES, isAdminKey } from './constants.js';
import { findPendingKeys, normalizeDelta } from './delta.js';
import { validateStringLeaf } from './icu.js';
import { readLocale, writeLocale } from './io.js';
import {
  deepMerge,
  flatFromNested,
  getValueAtPath,
  nestedFromFlat,
  setNestedValue,
} from './tree.js';
import { GLOBAL_RULES, styleForLocale } from './style.js';
import { verifyLocales } from './verify.js';

export function planTranslations({ locales = TARGET_LOCALES } = {}) {
  const en = readLocale(DEFAULT_LOCALE).data;
  const pending = {};
  const styles = {};

  for (const locale of locales) {
    const { data } = readLocale(locale);
    const keys = findPendingKeys(en, data, { exclude: isAdminKey });
    if (keys.length === 0) continue;

    pending[locale] = {};
    for (const key of keys) {
      pending[locale][key] = getValueAtPath(en, key);
    }

    const style = styleForLocale(locale);
    if (style) styles[locale] = style;
  }

  return {
    version: 1,
    pending,
    excluded: ['Admin.*'],
    rules: GLOBAL_RULES,
    styles,
    instructions:
      'Translate pending values per locale. Preserve ICU syntax and {placeholders}. Omit keys identical to English. Apply with: bun i18n:translate --apply <file>',
  };
}

export function applyTranslations(input, { locales = TARGET_LOCALES } = {}) {
  const en = readLocale(DEFAULT_LOCALE).data;
  const summaries = [];
  const validationErrors = [];

  const byLocale = normalizeApplyInput(input, TARGET_LOCALES);
  const targetLocales = locales;

  for (const locale of Object.keys(byLocale)) {
    if (!targetLocales.includes(locale)) {
      continue;
    }

    if (!TARGET_LOCALES.includes(locale)) {
      validationErrors.push(`Unknown locale "${locale}"`);
      continue;
    }

    const { data: current } = readLocale(locale);
    const merged = structuredClone(current);
    let added = 0;
    let skippedIdentical = 0;

    for (const [keyPath, translated] of Object.entries(byLocale[locale])) {
      if (isAdminKey(keyPath)) {
        validationErrors.push(`${locale}.${keyPath}: Admin keys cannot be translated`);
        continue;
      }

      const english = getValueAtPath(en, keyPath);
      if (english === undefined) {
        validationErrors.push(`${locale}.${keyPath}: key does not exist in en.json`);
        continue;
      }

      if (translated === english) {
        skippedIdentical++;
        continue;
      }

      if (typeof translated === 'string' && typeof english === 'string') {
        validationErrors.push(...validateStringLeaf(english, translated, `${locale}.${keyPath}`));
      }

      setNestedValue(merged, keyPath, translated);
      added++;
    }

    const normalized = normalizeDelta(en, merged) || {};
    writeLocale(locale, normalized);

    summaries.push({
      locale,
      added,
      skipped_identical: skippedIdentical,
      leaves: Object.keys(flatFromNested(normalized)).length,
    });
  }

  if (validationErrors.length > 0) {
    return { ok: false, summaries, errors: validationErrors };
  }

  const verify = verifyLocales({ locales: Object.keys(byLocale) });
  if (!verify.ok) {
    return { ok: false, summaries, errors: verify.errors };
  }

  return { ok: true, summaries, errors: [] };
}

function normalizeApplyInput(input, allowedLocales) {
  if (input.version === 1 && input.pending) {
    return input.pending;
  }

  const out = {};
  for (const [locale, entries] of Object.entries(input)) {
    if (!allowedLocales.includes(locale)) continue;
    if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) continue;

    const flat = {};
    for (const [key, value] of Object.entries(entries)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        flat[key] = String(value);
      }
    }
    if (Object.keys(flat).length > 0) out[locale] = flat;
  }
  return out;
}

export function mergeLocalePatch(locale, patchObject) {
  const en = readLocale(DEFAULT_LOCALE).data;
  const { data } = readLocale(locale);
  const merged = structuredClone(data);
  deepMerge(merged, patchObject);
  const normalized = normalizeDelta(en, merged) || {};
  writeLocale(locale, normalized);
  return normalized;
}

export function patchFromFlat(locale, flatEntries) {
  return nestedFromFlat(flatEntries);
}

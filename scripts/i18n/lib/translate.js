import { DEFAULT_LOCALE, TARGET_LOCALES, isExcludedTranslationKey } from './constants.js';
import { findPendingKeys, normalizeDelta } from './delta.js';
import { validateStringLeaf } from './icu.js';
import {
  acknowledgeInherited,
  clearInherited,
  pruneInherited,
  readInherited,
  writeInherited,
} from './inherited.js';
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
  const { inherited, removed } = pruneInherited(readInherited(), en);
  if (removed > 0) {
    writeInherited(inherited);
  }

  const pending = {};
  const styles = {};

  for (const locale of locales) {
    const { data } = readLocale(locale);
    const keys = findPendingKeys(en, data, {
      exclude: isExcludedTranslationKey,
      inherited,
      localeId: locale,
    });
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
    excluded: ['Admin.*', 'CustomViews.presets.*'],
    rules: GLOBAL_RULES,
    styles,
    instructions:
      'Translate every pending key per locale. Preserve ICU syntax and {placeholders}. Return all keys in apply JSON — identical-to-English values are recorded in inherited.json and will not be re-queued. Apply with: bun i18n:translate --apply <file>',
  };
}

export function applyTranslations(input, { locales = TARGET_LOCALES } = {}) {
  const en = readLocale(DEFAULT_LOCALE).data;
  const inherited = readInherited();
  const summaries = [];
  const validationErrors = [];

  const byLocale = normalizeApplyInput(input, TARGET_LOCALES);
  const targetLocaleSet = new Set(locales);
  const knownLocaleSet = new Set(TARGET_LOCALES);

  for (const locale of Object.keys(byLocale)) {
    if (!targetLocaleSet.has(locale)) {
      continue;
    }

    if (!knownLocaleSet.has(locale)) {
      validationErrors.push(`Unknown locale "${locale}"`);
      continue;
    }

    const { data: current } = readLocale(locale);
    const merged = structuredClone(current);
    let added = 0;
    let inheritedIdentical = 0;

    for (const [keyPath, translated] of Object.entries(byLocale[locale])) {
      if (isExcludedTranslationKey(keyPath)) {
        validationErrors.push(`${locale}.${keyPath}: excluded key cannot be translated`);
        continue;
      }

      const english = getValueAtPath(en, keyPath);
      if (english === undefined) {
        validationErrors.push(`${locale}.${keyPath}: key does not exist in en.json`);
        continue;
      }

      if (translated === english) {
        acknowledgeInherited(inherited, locale, keyPath, english);
        inheritedIdentical++;
        continue;
      }

      clearInherited(inherited, locale, keyPath);

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
      inherited_identical: inheritedIdentical,
      leaves: Object.keys(flatFromNested(normalized)).length,
    });
  }

  writeInherited(inherited);

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
  const allowedLocaleSet = new Set(allowedLocales);
  for (const [locale, entries] of Object.entries(input)) {
    if (!allowedLocaleSet.has(locale)) continue;
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

function mergeLocalePatch(locale, patchObject) {
  const en = readLocale(DEFAULT_LOCALE).data;
  const { data } = readLocale(locale);
  const merged = structuredClone(data);
  deepMerge(merged, patchObject);
  const normalized = normalizeDelta(en, merged) || {};
  writeLocale(locale, normalized);
  return normalized;
}

function patchFromFlat(locale, flatEntries) {
  return nestedFromFlat(flatEntries);
}

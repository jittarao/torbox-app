import { DEFAULT_LOCALE, TARGET_LOCALES } from './constants.js';
import { normalizeDelta } from './delta.js';
import { countLeaves } from './tree.js';
import { formatLocaleJson, readLocale, writeLocale } from './io.js';

export function syncLocales({ locales = TARGET_LOCALES, checkOnly = false } = {}) {
  const en = readLocale(DEFAULT_LOCALE).data;
  const changes = [];

  for (const locale of locales) {
    const { data, raw } = readLocale(locale);
    const normalized = normalizeDelta(en, data) || {};
    const formatted = formatLocaleJson(normalized);
    const beforeLeaves = countLeaves(data);
    const afterLeaves = countLeaves(normalized);
    const wouldChange = formatted !== raw;

    if (wouldChange) {
      changes.push({
        locale,
        beforeLeaves,
        afterLeaves,
        removed: beforeLeaves - afterLeaves,
      });
      if (!checkOnly) {
        writeLocale(locale, normalized);
      }
    }
  }

  return { changed: changes.length > 0, changes };
}

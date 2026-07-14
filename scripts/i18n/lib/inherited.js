import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { MESSAGES_DIR, TARGET_LOCALES } from './constants.js';
import { getValueAtPath } from './tree.js';

const INHERITED_PATH = path.join(MESSAGES_DIR, 'inherited.json');

function emptyInherited() {
  return Object.fromEntries(TARGET_LOCALES.map((locale) => [locale, {}]));
}

export function readInherited() {
  if (!existsSync(INHERITED_PATH)) {
    return emptyInherited();
  }

  const data = JSON.parse(readFileSync(INHERITED_PATH, 'utf8'));
  const out = emptyInherited();
  for (const locale of TARGET_LOCALES) {
    if (!data[locale] || typeof data[locale] !== 'object' || Array.isArray(data[locale])) {
      continue;
    }
    for (const [keyPath, englishValue] of Object.entries(data[locale])) {
      if (typeof keyPath === 'string' && typeof englishValue === 'string') {
        out[locale][keyPath] = englishValue;
      }
    }
  }
  return out;
}

export function writeInherited(data) {
  const normalized = emptyInherited();
  for (const locale of TARGET_LOCALES) {
    const entries = data[locale] || {};
    normalized[locale] = Object.fromEntries(
      Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))
    );
  }
  writeFileSync(INHERITED_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

export function pruneInherited(inherited, en) {
  const pruned = emptyInherited();
  let removed = 0;

  for (const locale of TARGET_LOCALES) {
    for (const [keyPath, acknowledgedEnglish] of Object.entries(inherited[locale] || {})) {
      const currentEnglish = getValueAtPath(en, keyPath);
      if (currentEnglish === undefined || currentEnglish !== acknowledgedEnglish) {
        removed++;
        continue;
      }
      pruned[locale][keyPath] = acknowledgedEnglish;
    }
  }

  return { inherited: pruned, removed };
}

export function isInheritedKey(inherited, locale, keyPath, enValue) {
  const acknowledged = inherited[locale]?.[keyPath];
  return acknowledged !== undefined && acknowledged === enValue;
}

export function acknowledgeInherited(inherited, locale, keyPath, englishValue) {
  if (!inherited[locale]) inherited[locale] = {};
  inherited[locale][keyPath] = englishValue;
}

export function clearInherited(inherited, locale, keyPath) {
  if (!inherited[locale]) return;
  delete inherited[locale][keyPath];
}

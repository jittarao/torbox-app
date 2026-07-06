import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { MESSAGES_DIR } from './constants.js';
import { sortKeys } from './tree.js';

export function localePath(locale) {
  return path.join(MESSAGES_DIR, `${locale}.json`);
}

export function readLocale(locale) {
  const raw = readFileSync(localePath(locale), 'utf8');
  return { data: JSON.parse(raw), raw };
}

export function formatLocaleJson(data) {
  return `${JSON.stringify(sortKeys(data), null, 2)}\n`;
}

export function writeLocale(locale, data) {
  const formatted = formatLocaleJson(data);
  writeFileSync(localePath(locale), formatted, 'utf8');
  return formatted;
}

export function isSorted(raw, data) {
  return raw === formatLocaleJson(data);
}

export function loadAllLocales(locales) {
  const out = {};
  for (const locale of locales) {
    out[locale] = readLocale(locale);
  }
  return out;
}

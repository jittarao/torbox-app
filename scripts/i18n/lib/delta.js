import { getValueAtPath, isPlainObject } from './tree.js';

export function pruneDelta(base, locale) {
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

export function findOrphanKeys(reference, locale) {
  const refKeys = new Set(collectKeyPaths(reference));
  return [...collectKeyPaths(locale)].filter((key) => !refKeys.has(key)).sort();
}

export function findRedundantKeys(base, locale, prefix = []) {
  const redundant = [];

  if (typeof base === 'string' && typeof locale === 'string') {
    if (base === locale) redundant.push(prefix.join('.'));
    return redundant;
  }

  if (!isPlainObject(base) || !isPlainObject(locale)) {
    if (JSON.stringify(base) === JSON.stringify(locale)) {
      redundant.push(prefix.join('.'));
    }
    return redundant;
  }

  for (const key of Object.keys(locale)) {
    if (!(key in base)) continue;
    redundant.push(...findRedundantKeys(base[key], locale[key], [...prefix, key]));
  }

  return redundant;
}

export function findPendingKeys(
  reference,
  locale,
  { exclude = () => false, inherited = {}, localeId } = {}
) {
  const refKeys = collectKeyPaths(reference);
  const localeKeys = new Set(collectKeyPaths(locale));
  return refKeys
    .filter((key) => {
      if (exclude(key) || localeKeys.has(key)) return false;
      const english = getValueAtPath(reference, key);
      if (localeId && inherited[localeId]?.[key] === english) return false;
      return true;
    })
    .sort();
}

function collectKeyPaths(obj, prefix = []) {
  if (!isPlainObject(obj)) return [prefix.join('.')];
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    out.push(...collectKeyPaths(value, [...prefix, key]));
  }
  return out;
}

export function normalizeDelta(base, locale) {
  const pruned = pruneDelta(base, locale) || {};
  return pruned;
}

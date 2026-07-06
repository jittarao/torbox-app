import { parse } from '@formatjs/icu-messageformat-parser';

const SIMPLE_PLACEHOLDER_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

export function extractSimplePlaceholders(text) {
  if (typeof text !== 'string') return [];

  const placeholders = new Set();
  for (const match of text.matchAll(SIMPLE_PLACEHOLDER_RE)) {
    placeholders.add(match[1]);
  }

  return [...placeholders].sort();
}

export function validateIcuSyntax(text, keyPath) {
  if (typeof text !== 'string') return null;

  try {
    parse(text);
    return null;
  } catch (error) {
    return `${keyPath}: invalid ICU syntax — ${error.message}`;
  }
}

export function validatePlaceholders(english, translated, keyPath) {
  if (typeof english !== 'string' || typeof translated !== 'string') return null;

  const required = extractSimplePlaceholders(english);
  const present = new Set(extractSimplePlaceholders(translated));
  const missing = required.filter((name) => !present.has(name));

  if (missing.length === 0) return null;
  return `${keyPath}: missing placeholder(s) {${missing.join('}, {')}}`;
}

export function validateStringLeaf(english, translated, keyPath) {
  const errors = [];
  const icuError = validateIcuSyntax(translated, keyPath);
  if (icuError) errors.push(icuError);

  const placeholderError = validatePlaceholders(english, translated, keyPath);
  if (placeholderError) errors.push(placeholderError);

  return errors;
}

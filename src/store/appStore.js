/**
 * App-level state that doesn't need reactive subscriptions — module-level state.
 */
const ensuredDbKeys = new Set();
const ensuringDb = new Set();

export function isDbEnsured(apiKey) {
  return ensuredDbKeys.has(apiKey);
}

export function isEnsuringDb(apiKey) {
  return ensuringDb.has(apiKey);
}

export function setEnsuringDb(apiKey, value) {
  value ? ensuringDb.add(apiKey) : ensuringDb.delete(apiKey);
}

export function markDbEnsured(apiKey) {
  ensuredDbKeys.add(apiKey);
}

export function clearEnsuredDbKeys() {
  ensuredDbKeys.clear();
  ensuringDb.clear();
}

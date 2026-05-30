const STORAGE_PREFIX = 'torbox';

export function getItem(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error(`storage.getItem error: ${key}`, e);
    return null;
  }
}

export function setItem(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn(`storage.setItem quota exceeded: ${key}`);
    } else {
      console.error(`storage.setItem error: ${key}`, e);
    }
  }
}

export function removeItem(key) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error(`storage.removeItem error: ${key}`, e);
  }
}

export function getJSON(key) {
  const raw = getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setJSON(key, value) {
  try {
    setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`storage.setJSON error: ${key}`, e);
  }
}

export function getPrefixedKey(namespace, key) {
  return `${STORAGE_PREFIX}:${namespace}:${key}`;
}

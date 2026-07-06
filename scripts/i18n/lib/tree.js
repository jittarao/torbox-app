export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function keyPaths(obj, prefix = []) {
  if (!isPlainObject(obj)) return [prefix.join('.')];
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    out.push(...keyPaths(value, [...prefix, key]));
  }
  return out;
}

export function* walkLeaves(obj, prefix = []) {
  if (!isPlainObject(obj)) {
    yield [prefix.join('.'), obj];
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    yield* walkLeaves(value, [...prefix, key]);
  }
}

export function getValueAtPath(obj, dotPath) {
  const parts = dotPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || !isPlainObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

export function setNestedValue(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isPlainObject(current[parts[i]])) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

export function sortKeys(obj) {
  if (!isPlainObject(obj)) return obj;
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

export function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

export function nestedFromFlat(flatEntries) {
  const root = {};
  for (const [dotPath, value] of Object.entries(flatEntries)) {
    setNestedValue(root, dotPath, value);
  }
  return root;
}

export function flatFromNested(obj, prefix = []) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = [...prefix, key].join('.');
    if (isPlainObject(value)) {
      Object.assign(out, flatFromNested(value, [...prefix, key]));
    } else {
      out[path] = value;
    }
  }
  return out;
}

export function countLeaves(obj) {
  if (typeof obj === 'string') return 1;
  if (!isPlainObject(obj)) return 1;
  return Object.values(obj).reduce((sum, value) => sum + countLeaves(value), 0);
}

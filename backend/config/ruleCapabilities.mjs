import registry from './automation-rule-capabilities.json';

const VALID_ASSET_TYPES = new Set(registry.assetTypes);
const torrentOnlyConditions = new Set(registry.torrentOnlyConditions);
const torrentOnlyActions = new Set(registry.torrentOnlyActions);
const allConditions = registry.allConditions;
const allActions = registry.allActions;

const conditionsByAsset = Object.freeze({
  torrent: new Set(allConditions),
  usenet: new Set(allConditions.filter((c) => !torrentOnlyConditions.has(c))),
  webdl: new Set(allConditions.filter((c) => !torrentOnlyConditions.has(c))),
});

const actionsByAsset = Object.freeze({
  torrent: new Set(allActions),
  usenet: new Set(allActions.filter((a) => !torrentOnlyActions.has(a))),
  webdl: new Set(allActions.filter((a) => !torrentOnlyActions.has(a))),
});

const conditionsCache = new Map();
const actionsCache = new Map();

/**
 * @param {string[]} assetTypes
 * @returns {string}
 */
export function buildCacheKey(assetTypes) {
  return [...assetTypes].sort().join('|');
}

/**
 * @param {unknown} assetTypes
 * @returns {string[]}
 */
export function normalizeAssetTypes(assetTypes) {
  if (!Array.isArray(assetTypes) || assetTypes.length === 0) {
    throw new Error('assetTypes must be a non-empty array');
  }
  const normalized = [...new Set(assetTypes.map((t) => String(t)))].sort();
  for (const t of normalized) {
    if (!VALID_ASSET_TYPES.has(t)) {
      throw new Error(`Invalid asset type: ${t}`);
    }
  }
  return normalized;
}

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {string[]}
 */
function intersectSets(a, b) {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  const out = [];
  for (const item of smaller) {
    if (larger.has(item)) out.push(item);
  }
  return out;
}

/**
 * @param {string[]} assetTypes
 * @param {Record<string, Set<string>>} byAsset
 * @param {Map<string, string[]>} cache
 * @returns {string[]}
 */
function getSupported(assetTypes, byAsset, cache) {
  const key = buildCacheKey(assetTypes);
  if (cache.has(key)) return cache.get(key);

  let resultSet = null;
  for (const type of assetTypes) {
    const set = byAsset[type];
    if (!set) continue;
    if (resultSet === null) {
      resultSet = new Set(set);
    } else {
      resultSet = new Set(intersectSets(resultSet, set));
    }
  }

  const result = resultSet ? [...resultSet].sort() : [];
  cache.set(key, result);
  return result;
}

/**
 * @param {string[]} assetTypes
 * @returns {string[]}
 */
export function getSupportedConditions(assetTypes) {
  const normalized = normalizeAssetTypes(assetTypes);
  return getSupported(normalized, conditionsByAsset, conditionsCache);
}

/**
 * @param {string[]} assetTypes
 * @returns {string[]}
 */
export function getSupportedActions(assetTypes) {
  const normalized = normalizeAssetTypes(assetTypes);
  return getSupported(normalized, actionsByAsset, actionsCache);
}

/**
 * @param {string} conditionType
 * @param {string[]} assetTypes
 * @returns {boolean}
 */
export function isConditionSupported(conditionType, assetTypes) {
  return getSupportedConditions(assetTypes).includes(conditionType);
}

/**
 * @param {string} actionType
 * @param {string[]} assetTypes
 * @returns {boolean}
 */
export function isActionSupported(actionType, assetTypes) {
  return getSupportedActions(assetTypes).includes(actionType);
}

/**
 * @param {Object} rule
 * @returns {{ kind: 'condition'|'action', name: string, assetTypes: string[] }|null}
 */
export function getRuleCompatibilityIssue(rule) {
  const raw = rule?.assetTypes;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { kind: 'condition', name: 'assetTypes', assetTypes: [] };
  }
  let assetTypes;
  try {
    assetTypes = normalizeAssetTypes(raw);
  } catch {
    return { kind: 'condition', name: 'assetTypes', assetTypes: raw };
  }

  const action = rule?.action || rule?.action_config;
  if (action?.type && !isActionSupported(action.type, assetTypes)) {
    return { kind: 'action', name: action.type, assetTypes };
  }

  const groups = rule?.groups;
  if (Array.isArray(groups)) {
    for (const group of groups) {
      for (const condition of group.conditions || []) {
        if (condition?.type && !isConditionSupported(condition.type, assetTypes)) {
          return { kind: 'condition', name: condition.type, assetTypes };
        }
      }
    }
  }

  return null;
}

export { registry as AUTOMATION_RULE_CAPABILITIES_REGISTRY };

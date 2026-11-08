/**
 * Portable automation-rules export format.
 *
 * Rules reference per-user tag row ids, which differ between users (a new TorBox API key is a
 * new authId and a fresh user DB). Exports therefore carry `{ id, name }` for every referenced
 * tag so import can remap ids by tag name.
 *
 * Keep RULES_EXPORT_FORMAT in sync with src/components/downloads/AutomationRules/ruleTransferFile.js.
 */

export const RULES_EXPORT_FORMAT = 'torbox-manager.automation-rules';
export const RULES_EXPORT_VERSION = 1;
export const MAX_IMPORT_RULES = 500;

const TAG_ACTION_TYPES = new Set(['add_tag', 'remove_tag']);
const MAX_TAG_NAME_LENGTH = 100;

export class RulesImportFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RulesImportFormatError';
    this.isValidationError = true;
  }
}

function isTagCondition(condition) {
  return condition?.type === 'TAGS' && Array.isArray(condition.value);
}

function hasTagAction(rule) {
  return TAG_ACTION_TYPES.has(rule?.action?.type) && Array.isArray(rule.action.tagIds);
}

/**
 * @param {object} rule - Rule in group structure
 * @returns {Set<number>} tag ids referenced by tag actions and TAGS conditions
 */
export function collectReferencedTagIds(rule) {
  const ids = new Set();
  if (hasTagAction(rule)) {
    for (const id of rule.action.tagIds) ids.add(Number(id));
  }
  for (const group of rule?.groups || []) {
    for (const condition of group?.conditions || []) {
      if (isTagCondition(condition)) {
        for (const id of condition.value) ids.add(Number(id));
      }
    }
  }
  return ids;
}

/**
 * Keep only user-authored rule fields (drop ids, run stats, timestamps, metadata).
 * @param {object} rule - Rule in group structure
 */
export function toPortableRule(rule) {
  return {
    name: rule.name,
    enabled: rule.enabled === true,
    assetTypes:
      Array.isArray(rule.assetTypes) && rule.assetTypes.length > 0
        ? [...rule.assetTypes]
        : ['torrent'],
    trigger: rule.trigger,
    logicOperator: rule.logicOperator || 'and',
    groups: Array.isArray(rule.groups) ? rule.groups : [],
    action: rule.action,
  };
}

/**
 * @param {Array<object>} rules - Rules from RuleRepository.getRules()
 * @param {Array<{ id: number, name: string }>} tags - All tags for the user
 * @param {Date} [now]
 */
export function buildRulesExport(rules, tags, now = new Date()) {
  const portableRules = rules.map(toPortableRule);
  const referenced = new Set();
  for (const rule of portableRules) {
    for (const id of collectReferencedTagIds(rule)) referenced.add(id);
  }
  return {
    format: RULES_EXPORT_FORMAT,
    version: RULES_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    rules: portableRules,
    tags: tags
      .filter((tag) => referenced.has(Number(tag.id)))
      .map((tag) => ({ id: Number(tag.id), name: tag.name })),
  };
}

/**
 * Validate the export envelope. Individual rules are validated later by RuleValidator.
 * @param {unknown} payload
 * @returns {{ rules: Array<unknown>, tagNamesById: Map<number, string> }}
 */
export function parseRulesImport(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RulesImportFormatError('Import file must be a JSON object');
  }
  if (payload.format !== RULES_EXPORT_FORMAT) {
    throw new RulesImportFormatError('File is not a TorBox Manager automation rules export');
  }
  if (
    !Number.isInteger(payload.version) ||
    payload.version < 1 ||
    payload.version > RULES_EXPORT_VERSION
  ) {
    throw new RulesImportFormatError(`Unsupported export version: ${payload.version}`);
  }
  if (!Array.isArray(payload.rules)) {
    throw new RulesImportFormatError('Export is missing a rules array');
  }
  if (payload.rules.length === 0) {
    throw new RulesImportFormatError('Export contains no rules');
  }
  if (payload.rules.length > MAX_IMPORT_RULES) {
    throw new RulesImportFormatError(
      `Export contains ${payload.rules.length} rules; the limit is ${MAX_IMPORT_RULES}`
    );
  }

  const tagNamesById = new Map();
  for (const tag of Array.isArray(payload.tags) ? payload.tags : []) {
    const id = Number(tag?.id);
    const name = typeof tag?.name === 'string' ? tag.name.trim() : '';
    if (Number.isInteger(id) && id > 0 && name && name.length <= MAX_TAG_NAME_LENGTH) {
      tagNamesById.set(id, name);
    }
  }

  return { rules: payload.rules, tagNamesById };
}

/**
 * @param {object} rule
 * @param {Map<number, string>} tagNamesById
 * @returns {number[]} referenced tag ids with no name in the export
 */
export function findUnresolvedTagIds(rule, tagNamesById) {
  return [...collectReferencedTagIds(rule)].filter((id) => !tagNamesById.has(id));
}

/**
 * @param {object} rule
 * @param {Map<number, number>} idMap - export tag id -> destination tag id
 */
export function remapRuleTagIds(rule, idMap) {
  const mapId = (id) => idMap.get(Number(id));
  const action = hasTagAction(rule)
    ? { ...rule.action, tagIds: rule.action.tagIds.map(mapId) }
    : rule.action;
  const groups = (rule.groups || []).map((group) => ({
    ...group,
    conditions: (group.conditions || []).map((condition) =>
      isTagCondition(condition) ? { ...condition, value: condition.value.map(mapId) } : condition
    ),
  }));
  return { ...rule, action, groups };
}

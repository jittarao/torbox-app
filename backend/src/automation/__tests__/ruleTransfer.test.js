import { describe, expect, test } from 'bun:test';
import {
  MAX_IMPORT_RULES,
  RULES_EXPORT_FORMAT,
  RULES_EXPORT_VERSION,
  RulesImportFormatError,
  buildRulesExport,
  collectReferencedTagIds,
  findUnresolvedTagIds,
  parseRulesImport,
  remapRuleTagIds,
  toPortableRule,
} from '../helpers/ruleTransfer.js';

function storedRule(overrides = {}) {
  return {
    id: 12,
    name: 'Tag finished',
    enabled: true,
    assetTypes: ['torrent'],
    trigger: { type: 'interval', value: 30 },
    logicOperator: 'and',
    groups: [
      {
        logicOperator: 'and',
        conditions: [{ type: 'TAGS', operator: 'is_any_of', value: [3] }],
      },
    ],
    action: { type: 'add_tag', tagIds: [4] },
    metadata: { createdAt: 1 },
    last_executed_at: '2026-01-01 00:00:00',
    last_evaluated_at: '2026-01-01 00:00:00',
    execution_count: 9,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
    ...overrides,
  };
}

describe('collectReferencedTagIds', () => {
  test('collects ids from tag actions and TAGS conditions', () => {
    expect([...collectReferencedTagIds(storedRule())].sort()).toEqual([3, 4]);
  });

  test('ignores tagIds on non-tag actions', () => {
    const rule = storedRule({ action: { type: 'archive', tagIds: [99] }, groups: [] });
    expect(collectReferencedTagIds(rule).size).toBe(0);
  });
});

describe('toPortableRule', () => {
  test('strips id, stats and metadata', () => {
    expect(toPortableRule(storedRule())).toEqual({
      name: 'Tag finished',
      enabled: true,
      assetTypes: ['torrent'],
      trigger: { type: 'interval', value: 30 },
      logicOperator: 'and',
      groups: storedRule().groups,
      action: { type: 'add_tag', tagIds: [4] },
    });
  });

  test('defaults missing enabled to false and missing assetTypes to torrent', () => {
    const portable = toPortableRule({ name: 'x', trigger: {}, action: { type: 'archive' } });
    expect(portable.enabled).toBe(false);
    expect(portable.assetTypes).toEqual(['torrent']);
    expect(portable.groups).toEqual([]);
  });
});

describe('buildRulesExport', () => {
  test('includes only referenced tags and stamps format/version', () => {
    const tags = [
      { id: 3, name: 'Movies', created_at: 'x' },
      { id: 4, name: 'Done' },
      { id: 5, name: 'Unused' },
    ];
    const now = new Date('2026-11-08T10:00:00.000Z');
    const result = buildRulesExport([storedRule()], tags, now);

    expect(result.format).toBe(RULES_EXPORT_FORMAT);
    expect(result.version).toBe(RULES_EXPORT_VERSION);
    expect(result.exportedAt).toBe('2026-11-08T10:00:00.000Z');
    expect(result.rules[0].id).toBeUndefined();
    expect(result.tags).toEqual([
      { id: 3, name: 'Movies' },
      { id: 4, name: 'Done' },
    ]);
  });
});

describe('parseRulesImport', () => {
  const valid = () => ({
    format: RULES_EXPORT_FORMAT,
    version: 1,
    rules: [{ name: 'a' }],
    tags: [
      { id: 3, name: ' Movies ' },
      { id: 'bad', name: 'x' },
      { id: 4, name: '' },
    ],
  });

  test('returns rules and a sanitized tag map', () => {
    const { rules, tagNamesById } = parseRulesImport(valid());
    expect(rules).toHaveLength(1);
    expect([...tagNamesById]).toEqual([[3, 'Movies']]);
  });

  test.each([
    ['null payload', null],
    ['array payload', []],
    ['wrong format', { ...valid(), format: 'other' }],
    ['future version', { ...valid(), version: 2 }],
    ['missing rules', { ...valid(), rules: undefined }],
    ['empty rules', { ...valid(), rules: [] }],
    ['too many rules', { ...valid(), rules: new Array(MAX_IMPORT_RULES + 1).fill({}) }],
  ])('rejects %s', (_label, payload) => {
    expect(() => parseRulesImport(payload)).toThrow(RulesImportFormatError);
  });
});

describe('findUnresolvedTagIds / remapRuleTagIds', () => {
  test('reports ids missing from the export tag map', () => {
    expect(findUnresolvedTagIds(storedRule(), new Map([[3, 'Movies']]))).toEqual([4]);
  });

  test('remaps action tagIds and TAGS condition values without mutating input', () => {
    const rule = storedRule();
    const remapped = remapRuleTagIds(
      rule,
      new Map([
        [3, 30],
        [4, 40],
      ])
    );
    expect(remapped.action.tagIds).toEqual([40]);
    expect(remapped.groups[0].conditions[0].value).toEqual([30]);
    expect(rule.action.tagIds).toEqual([4]);
    expect(rule.groups[0].conditions[0].value).toEqual([3]);
  });
});

import { describe, expect, test } from 'bun:test';
import RuleValidator from '../helpers/RuleValidator.js';
import RuleMigrationHelper from '../helpers/RuleMigrationHelper.js';

const validator = new RuleValidator('test-auth', (rule) =>
  RuleMigrationHelper.migrateRuleToGroups(rule)
);

const baseRule = () => ({
  name: 'Test',
  enabled: true,
  assetTypes: ['torrent'],
  trigger: { type: 'interval', value: 30 },
  logicOperator: 'and',
  groups: [
    {
      logicOperator: 'and',
      conditions: [{ type: 'STATUS', operator: 'is_any_of', value: ['completed'] }],
    },
  ],
  action: { type: 'delete' },
});

describe('RuleValidator assetTypes', () => {
  test('requires assetTypes', () => {
    const rule = baseRule();
    delete rule.assetTypes;
    const { valid, errors } = validator.validate(rule);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('assetTypes'))).toBe(true);
  });

  test('rejects RATIO for usenet-only rule', () => {
    const rule = {
      ...baseRule(),
      assetTypes: ['usenet'],
      groups: [
        {
          logicOperator: 'and',
          conditions: [{ type: 'RATIO', operator: 'gt', value: 1 }],
        },
      ],
    };
    const { valid, errors } = validator.validate(rule);
    expect(valid).toBe(false);
    expect(
      errors.some((e) => e.includes('Condition RATIO is not supported for asset types [usenet]'))
    ).toBe(true);
  });

  test('rejects stop_seeding for webdl rule', () => {
    const rule = {
      ...baseRule(),
      assetTypes: ['webdl'],
      action: { type: 'stop_seeding' },
    };
    const { valid, errors } = validator.validate(rule);
    expect(valid).toBe(false);
    expect(
      errors.some((e) => e.includes('Action stop_seeding is not supported for asset types [webdl]'))
    ).toBe(true);
  });

  test('rejects archive for usenet rule', () => {
    const rule = {
      ...baseRule(),
      assetTypes: ['usenet'],
      action: { type: 'archive' },
    };
    const { valid, errors } = validator.validate(rule);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Action archive is not supported'))).toBe(true);
  });

  test('accepts shared conditions for torrent+usenet', () => {
    const rule = {
      ...baseRule(),
      assetTypes: ['torrent', 'usenet'],
      action: { type: 'delete' },
    };
    const { valid } = validator.validate(rule);
    expect(valid).toBe(true);
  });
});

import { describe, expect, test } from 'bun:test';
import { BOOLEAN_OPERATORS } from '@/components/downloads/AutomationRules/constants';
import { itemMatchesFilters } from '../filterEvaluation';

function protectedFilter(operator) {
  return {
    logicOperator: 'and',
    groups: [
      {
        logicOperator: 'and',
        filters: [{ column: 'is_protected', operator, value: true }],
      },
    ],
  };
}

describe('itemMatchesFilters is_protected column', () => {
  test('is_true matches protected items only', () => {
    const filters = protectedFilter(BOOLEAN_OPERATORS.IS_TRUE);

    expect(itemMatchesFilters({ is_protected: true }, filters)).toBe(true);
    expect(itemMatchesFilters({ is_protected: false }, filters)).toBe(false);
    expect(itemMatchesFilters({}, filters)).toBe(false);
  });

  test('is_false matches unprotected items including missing flag', () => {
    const filters = protectedFilter(BOOLEAN_OPERATORS.IS_FALSE);

    expect(itemMatchesFilters({ is_protected: false }, filters)).toBe(true);
    expect(itemMatchesFilters({}, filters)).toBe(true);
    expect(itemMatchesFilters({ is_protected: true }, filters)).toBe(false);
  });
});

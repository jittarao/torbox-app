import { describe, expect, test } from 'bun:test';
import { TAG_OPERATORS } from '@/components/downloads/AutomationRules/constants';
import { tagOperatorNeedsTagSelection } from '../tagFilterHelpers';
import { itemMatchesFilters } from '../filterEvaluation';

const filtersWithTagRule = (operator, value = []) => ({
  logicOperator: 'and',
  groups: [
    {
      logicOperator: 'and',
      filters: [{ column: 'tags', operator, value }],
    },
  ],
});

describe('itemMatchesFilters tags column', () => {
  test('is_set matches downloads with at least one tag', () => {
    const filters = filtersWithTagRule(TAG_OPERATORS.IS_SET);
    expect(itemMatchesFilters({ tags: [{ id: 1, name: 'a' }] }, filters)).toBe(true);
    expect(itemMatchesFilters({ tags: [] }, filters)).toBe(false);
    expect(itemMatchesFilters({}, filters)).toBe(false);
  });

  test('is_not_set matches downloads with no tags', () => {
    const filters = filtersWithTagRule(TAG_OPERATORS.IS_NOT_SET);
    expect(itemMatchesFilters({ tags: [] }, filters)).toBe(true);
    expect(itemMatchesFilters({}, filters)).toBe(true);
    expect(itemMatchesFilters({ tags: [{ id: 2, name: 'b' }] }, filters)).toBe(false);
  });

  test('is_any_of matches when item has a selected tag', () => {
    const filters = filtersWithTagRule(TAG_OPERATORS.IS_ANY_OF, [1, 2]);
    expect(itemMatchesFilters({ tags: [{ id: 2, name: 'b' }] }, filters)).toBe(true);
    expect(itemMatchesFilters({ tags: [{ id: 9, name: 'x' }] }, filters)).toBe(false);
  });
});

describe('tagFilterHelpers', () => {
  test('tagOperatorNeedsTagSelection identifies tag-picking operators', () => {
    expect(tagOperatorNeedsTagSelection(TAG_OPERATORS.IS_ANY_OF)).toBe(true);
    expect(tagOperatorNeedsTagSelection(TAG_OPERATORS.IS_SET)).toBe(false);
  });
});

describe('itemMatchesFilters airlocked column', () => {
  const filtersWithAirlockRule = (operator, value) => ({
    logicOperator: 'and',
    groups: [
      {
        logicOperator: 'and',
        filters: [{ column: 'airlocked', operator, value }],
      },
    ],
  });

  test('is_true matches airlocked downloads', () => {
    const filters = filtersWithAirlockRule('is_true', true);
    expect(itemMatchesFilters({ airlocked: true }, filters)).toBe(true);
    expect(itemMatchesFilters({ airlocked: false }, filters)).toBe(false);
    expect(itemMatchesFilters({}, filters)).toBe(false);
  });

  test('is_false matches unlocked downloads and missing airlocked values', () => {
    const filters = filtersWithAirlockRule('is_false', false);
    expect(itemMatchesFilters({ airlocked: false }, filters)).toBe(true);
    expect(itemMatchesFilters({}, filters)).toBe(true);
    expect(itemMatchesFilters({ airlocked: true }, filters)).toBe(false);
  });
});

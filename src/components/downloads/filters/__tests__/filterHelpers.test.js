import { describe, expect, test } from 'bun:test';
import {
  LOGIC_OPERATORS,
  STRING_OPERATORS,
} from '@/components/downloads/AutomationRules/constants';
import {
  buildTrackerFilter,
  getActiveTrackers,
  isTrackerOnlyFilter,
  EMPTY_FILTERS,
} from '../filterHelpers';

describe('tracker filter helpers', () => {
  const urlA = 'https://tracker.example.com/announce';
  const urlB = 'https://tracker.other.org/announce';

  test('buildTrackerFilter creates OR group of tracker equals rules', () => {
    const filters = buildTrackerFilter([urlA, urlB]);
    expect(filters.logicOperator).toBe(LOGIC_OPERATORS.AND);
    expect(filters.groups).toHaveLength(1);
    expect(filters.groups[0].logicOperator).toBe(LOGIC_OPERATORS.OR);
    expect(filters.groups[0].filters).toEqual([
      { column: 'tracker', operator: STRING_OPERATORS.EQUALS, value: urlA },
      { column: 'tracker', operator: STRING_OPERATORS.EQUALS, value: urlB },
    ]);
  });

  test('buildTrackerFilter returns empty filters for no urls', () => {
    expect(buildTrackerFilter([])).toEqual(EMPTY_FILTERS);
    expect(buildTrackerFilter(['', '  '])).toEqual(EMPTY_FILTERS);
  });

  test('isTrackerOnlyFilter and getActiveTrackers round-trip', () => {
    const filters = buildTrackerFilter([urlA, urlB]);
    expect(isTrackerOnlyFilter(filters)).toBe(true);
    expect(getActiveTrackers(filters)).toEqual([urlA, urlB]);
  });

  test('getActiveTrackers returns null for mixed filters', () => {
    const filters = {
      logicOperator: LOGIC_OPERATORS.AND,
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters: [
            { column: 'tracker', operator: STRING_OPERATORS.EQUALS, value: urlA },
            { column: 'name', operator: STRING_OPERATORS.CONTAINS, value: 'test' },
          ],
        },
      ],
    };
    expect(isTrackerOnlyFilter(filters)).toBe(false);
    expect(getActiveTrackers(filters)).toBeNull();
  });
});

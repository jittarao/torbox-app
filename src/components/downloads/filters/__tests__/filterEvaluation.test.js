import { describe, expect, test } from 'bun:test';
import { TAG_OPERATORS, STRING_OPERATORS } from '@/components/downloads/AutomationRules/constants';
import { tagOperatorNeedsTagSelection } from '../tagFilterHelpers';
import { itemMatchesFilters } from '../filterEvaluation';
import { buildTrackerFilter, buildSourceFilter } from '../filterHelpers';

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

describe('itemMatchesFilters tracker column', () => {
  const urlA = 'https://tracker.example.com/announce';
  const urlB = 'https://tracker.other.org/announce';

  test('multi-tracker OR filter matches any selected tracker', () => {
    const filters = buildTrackerFilter([urlA, urlB]);
    expect(itemMatchesFilters({ tracker: urlA }, filters)).toBe(true);
    expect(itemMatchesFilters({ tracker: urlB }, filters)).toBe(true);
    expect(itemMatchesFilters({ tracker: 'https://unknown.example' }, filters)).toBe(false);
    expect(itemMatchesFilters({ asset_type: 'usenet' }, filters)).toBe(false);
  });

  test('single tracker equals matches case-insensitively', () => {
    const filters = {
      logicOperator: 'and',
      groups: [
        {
          logicOperator: 'or',
          filters: [{ column: 'tracker', operator: STRING_OPERATORS.EQUALS, value: urlA }],
        },
      ],
    };
    expect(itemMatchesFilters({ tracker: urlA }, filters)).toBe(true);
    expect(itemMatchesFilters({ tracker: urlA.toUpperCase() }, filters)).toBe(true);
    expect(itemMatchesFilters({ tracker: 'https://other.example' }, filters)).toBe(false);
  });
});

describe('itemMatchesFilters original_url source host', () => {
  const hostA = 'pixeldrain.com';
  const hostB = 'drive.google.com';

  test('multi-source OR filter matches any selected host', () => {
    const filters = buildSourceFilter([hostA, hostB]);
    expect(
      itemMatchesFilters({ original_url: 'https://pixeldrain.com/api/file/abc' }, filters)
    ).toBe(true);
    expect(
      itemMatchesFilters({ original_url: 'https://drive.google.com/file/d/xyz' }, filters)
    ).toBe(true);
    expect(itemMatchesFilters({ original_url: 'https://mega.nz/file/abc' }, filters)).toBe(false);
    expect(itemMatchesFilters({ asset_type: 'torrents' }, filters)).toBe(false);
  });

  test('hostname equals matches case-insensitively', () => {
    const filters = buildSourceFilter([hostA]);
    expect(
      itemMatchesFilters({ original_url: 'https://PixelDrain.com/api/file/abc' }, filters)
    ).toBe(true);
    expect(
      itemMatchesFilters({ original_url: 'https://www.pixeldrain.com/api/file/abc' }, filters)
    ).toBe(true);
  });

  test('full URL equals still matches exact original_url for custom views', () => {
    const fullUrl = 'https://pixeldrain.com/api/file/abc';
    const filters = {
      logicOperator: 'and',
      groups: [
        {
          logicOperator: 'or',
          filters: [{ column: 'original_url', operator: STRING_OPERATORS.EQUALS, value: fullUrl }],
        },
      ],
    };
    expect(itemMatchesFilters({ original_url: fullUrl }, filters)).toBe(true);
    expect(
      itemMatchesFilters({ original_url: 'https://pixeldrain.com/api/file/other' }, filters)
    ).toBe(false);
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

describe('itemMatchesFilters unit conversions', () => {
  const numericFilter = (column, operator, value) => ({
    logicOperator: 'and',
    groups: [{ logicOperator: 'and', filters: [{ column, operator, value }] }],
  });

  test('file size compares in GB', () => {
    const filters = numericFilter('size', 'gt', 10);
    const elevenGb = 11 * 1024 * 1024 * 1024;
    const nineGb = 9 * 1024 * 1024 * 1024;
    expect(itemMatchesFilters({ size: elevenGb }, filters)).toBe(true);
    expect(itemMatchesFilters({ size: nineGb }, filters)).toBe(false);
  });

  test('download speed compares in MB/s', () => {
    const filters = numericFilter('download_speed', 'gt', 1);
    const twoMbpsBytes = 2 * 1024 * 1024;
    const halfMbpsBytes = 0.5 * 1024 * 1024;
    expect(itemMatchesFilters({ download_speed: twoMbpsBytes }, filters)).toBe(true);
    expect(itemMatchesFilters({ download_speed: halfMbpsBytes }, filters)).toBe(false);
  });

  test('age compares hours since created_at', () => {
    const filters = numericFilter('age', 'lt', 48);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(itemMatchesFilters({ created_at: oneDayAgo }, filters)).toBe(true);
    expect(itemMatchesFilters({ created_at: threeDaysAgo }, filters)).toBe(false);
  });

  test('eta compares minutes', () => {
    const filters = numericFilter('eta', 'lt', 30);
    expect(itemMatchesFilters({ eta: 15 * 60 }, filters)).toBe(true);
    expect(itemMatchesFilters({ eta: 45 * 60 }, filters)).toBe(false);
  });

  test('active boolean matches entity.active', () => {
    const filters = {
      logicOperator: 'and',
      groups: [
        {
          logicOperator: 'and',
          filters: [{ column: 'active', operator: 'is_true', value: true }],
        },
      ],
    };
    expect(itemMatchesFilters({ active: true }, filters)).toBe(true);
    expect(itemMatchesFilters({ active: false }, filters)).toBe(false);
  });
});

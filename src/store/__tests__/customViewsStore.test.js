import { describe, expect, test } from 'bun:test';
import { reorderViewsByIds, normalizeLoadedViews } from '@/store/customViewsStore';
import { FILTER_SCHEMA_VERSION } from '@/components/downloads/filters/filterHelpers';

describe('reorderViewsByIds', () => {
  const views = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' },
  ];

  test('reorders views to match ordered ids', () => {
    expect(reorderViewsByIds(views, [3, 1, 2])).toEqual([
      { id: 3, name: 'C' },
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
  });

  test('drops unknown ids', () => {
    expect(reorderViewsByIds(views, [2, 99, 1])).toEqual([
      { id: 2, name: 'B' },
      { id: 1, name: 'A' },
    ]);
  });
});

describe('normalizeLoadedViews', () => {
  test('stamps schema version on loaded views', () => {
    const [normalized] = normalizeLoadedViews([
      {
        id: 1,
        name: 'Completed',
        filters: {
          groups: [
            {
              logicOperator: 'and',
              filters: [{ column: 'download_state', operator: 'is_any_of', value: ['completed'] }],
            },
          ],
        },
      },
    ]);

    expect(normalized.filters._filterSchemaVersion).toBe(FILTER_SCHEMA_VERSION);
  });
});

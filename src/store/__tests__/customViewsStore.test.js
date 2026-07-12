import { describe, expect, test } from 'bun:test';
import { reorderViewsByIds } from '@/store/customViewsStore';

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

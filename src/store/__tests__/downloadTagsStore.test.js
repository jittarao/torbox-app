import { describe, expect, test } from 'bun:test';
import { applyOptimisticTagMappings } from '@/store/downloadTagsStore';

describe('applyOptimisticTagMappings', () => {
  const allTags = [
    { id: 1, name: 'Movies' },
    { id: 2, name: 'TV' },
  ];

  test('add merges tags for download ids', () => {
    const next = applyOptimisticTagMappings({}, ['42'], [1], 'add', allTags);
    expect(next['42']).toEqual([{ id: 1, name: 'Movies' }]);
  });

  test('add appends without duplicating existing tags', () => {
    const next = applyOptimisticTagMappings(
      { 42: [{ id: 1, name: 'Movies' }] },
      ['42'],
      [1, 2],
      'add',
      allTags
    );
    expect(next['42']).toEqual([
      { id: 1, name: 'Movies' },
      { id: 2, name: 'TV' },
    ]);
  });

  test('remove drops tags and clears empty download keys', () => {
    const next = applyOptimisticTagMappings(
      { 42: [{ id: 1, name: 'Movies' }] },
      ['42'],
      [1],
      'remove',
      allTags
    );
    expect(next['42']).toBeUndefined();
  });

  test('remove keeps remaining tags on a download', () => {
    const next = applyOptimisticTagMappings(
      {
        42: [
          { id: 1, name: 'Movies' },
          { id: 2, name: 'TV' },
        ],
      },
      ['42'],
      [1],
      'remove',
      allTags
    );
    expect(next['42']).toEqual([{ id: 2, name: 'TV' }]);
  });
});

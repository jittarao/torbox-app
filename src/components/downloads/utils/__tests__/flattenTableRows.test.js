import { describe, expect, test } from 'bun:test';
import { buildFlattenedTableRows } from '../flattenTableRows.js';
import { MAX_INLINE_FILE_ROWS } from '../tableConstants.js';

describe('buildFlattenedTableRows', () => {
  const item = { id: 1, assetType: 'torrents', name: 'Test', files: [] };

  test('includes only item row when collapsed', () => {
    const rows = buildFlattenedTableRows([item], new Set(), {}, () => [], '');
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('item');
  });

  test('caps inline file rows and adds overflow row', () => {
    const files = Array.from({ length: MAX_INLINE_FILE_ROWS + 10 }, (_, i) => ({
      id: i,
      name: `f${i}`,
    }));
    const itemWithFiles = { ...item, files };
    const rows = buildFlattenedTableRows([itemWithFiles], new Set([1]), {}, () => files, '');
    const fileRows = rows.filter((r) => r.type === 'file');
    const overflow = rows.filter((r) => r.type === 'fileOverflow');
    expect(fileRows).toHaveLength(MAX_INLINE_FILE_ROWS);
    expect(overflow).toHaveLength(1);
    expect(overflow[0].overflowCount).toBe(10);
  });

  test('uncapped id shows all files', () => {
    const files = Array.from({ length: MAX_INLINE_FILE_ROWS + 5 }, (_, i) => ({
      id: i,
      name: `f${i}`,
    }));
    const itemWithFiles = { ...item, files };
    const rows = buildFlattenedTableRows(
      [itemWithFiles],
      new Set([1]),
      { 1: true },
      () => files,
      ''
    );
    expect(rows.filter((r) => r.type === 'file')).toHaveLength(files.length);
    expect(rows.filter((r) => r.type === 'fileOverflow')).toHaveLength(0);
  });
});

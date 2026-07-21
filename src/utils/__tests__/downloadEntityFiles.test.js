import { describe, expect, test } from 'bun:test';
import {
  slimRowForStorage,
  getItemFileCount,
  resolveItemFiles,
  applyFilesCacheEntry,
  updateFilesCacheEntry,
  shouldEvictFilesCache,
} from '../downloadEntityFiles.js';

describe('slimRowForStorage', () => {
  test('strips files and keeps fileCount + fileListSignature', () => {
    const files = [
      { id: 1, size: 100 },
      { id: 2, size: 200 },
    ];
    const { slim, files: extracted } = slimRowForStorage({
      id: 9,
      name: 'test',
      files,
    });
    expect(slim.files).toBeUndefined();
    expect(slim.fileCount).toBe(2);
    expect(slim.fileListSignature).toBe('1:100|2:200');
    expect(extracted).toBe(files);
  });

  test('handles rows without files', () => {
    const { slim, files } = slimRowForStorage({ id: 1, file_count: 0 });
    expect(slim.fileCount).toBe(0);
    expect(slim.fileListSignature).toBe('');
    expect(files).toBeNull();
  });
});

describe('getItemFileCount', () => {
  test('prefers fileCount on slim entity', () => {
    expect(getItemFileCount({ fileCount: 3 })).toBe(3);
  });

  test('falls back to files.length and file_count', () => {
    expect(getItemFileCount({ files: [{ id: 1 }] })).toBe(1);
    expect(getItemFileCount({ file_count: 5 })).toBe(5);
  });
});

describe('resolveItemFiles', () => {
  test('reads from side cache by selection id', () => {
    const files = [{ id: 1 }];
    const item = { id: 42, assetType: 'torrents' };
    const cache = { 'torrents:42': files };
    expect(resolveItemFiles(item, cache)).toBe(files);
  });
});

describe('shouldEvictFilesCache', () => {
  test('keeps cache when slim row still has files metadata', () => {
    expect(shouldEvictFilesCache({ fileCount: 2, fileListSignature: '1:1|2:2' })).toBe(false);
  });

  test('evicts when slim row has no files metadata', () => {
    expect(shouldEvictFilesCache({ fileCount: 0, fileListSignature: '' })).toBe(true);
  });
});

describe('applyFilesCacheEntry', () => {
  test('mutates cache in place when entry changes', () => {
    const cache = {};
    const changed = applyFilesCacheEntry(
      cache,
      'torrents:1',
      { fileListSignature: '1:1' },
      [{ id: 1, size: 1 }],
      undefined,
      undefined
    );
    expect(changed).toBe(true);
    expect(cache['torrents:1']).toEqual([{ id: 1, size: 1 }]);
  });

  test('does not evict cache for slim row without inline files[]', () => {
    const prevFiles = [{ id: 1, size: 1 }];
    const cache = { 'torrents:1': prevFiles };
    const changed = applyFilesCacheEntry(
      cache,
      'torrents:1',
      { fileCount: 1, fileListSignature: '1:1' },
      null,
      { fileListSignature: '1:1' },
      prevFiles
    );
    expect(changed).toBe(false);
    expect(cache['torrents:1']).toBe(prevFiles);
  });

  test('skips mutation when cached ref unchanged', () => {
    const prevFiles = [{ id: 1, size: 1 }];
    const cache = { 'torrents:1': prevFiles };
    const changed = applyFilesCacheEntry(
      cache,
      'torrents:1',
      { fileListSignature: '1:1' },
      [{ id: 1, size: 1 }],
      { fileListSignature: '1:1' },
      prevFiles
    );
    expect(changed).toBe(false);
    expect(cache['torrents:1']).toBe(prevFiles);
  });
});

describe('updateFilesCacheEntry', () => {
  test('reuses prior cache when signature unchanged', () => {
    const prevFiles = [{ id: 1, size: 1 }];
    const slim = { fileListSignature: '1:1' };
    const prevEntity = { fileListSignature: '1:1' };
    const next = updateFilesCacheEntry(
      {},
      'torrents:1',
      slim,
      [{ id: 1, size: 1 }],
      prevEntity,
      prevFiles
    );
    expect(next['torrents:1']).toBe(prevFiles);
  });
});

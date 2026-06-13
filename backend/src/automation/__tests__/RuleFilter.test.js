import { describe, it, expect, beforeEach, mock } from 'bun:test';
import RuleFilter from '../helpers/RuleFilter.js';

describe('RuleFilter', () => {
  let ruleFilter;
  let mockUserDb;
  let getUserDb;

  beforeEach(() => {
    const mockGet = mock(() => null);
    const mockAll = mock(() => []);
    const mockRun = mock(() => ({ changes: 1 }));

    mockUserDb = {
      prepare: mock((query) => ({
        get: mockGet,
        all: mockAll,
        run: mockRun,
      })),
    };

    getUserDb = mock(() => Promise.resolve(mockUserDb));
    ruleFilter = new RuleFilter('auth-1', getUserDb);
  });

  describe('filterForAddTag', () => {
    it('uses preloaded tags and skips torrents that already have all tags', async () => {
      const torrents = [
        { id: '1', name: 'has tags' },
        { id: '2', name: 'missing tags' },
      ];
      const tagsByDownloadId = new Map([
        ['1', [1, 2]],
        ['2', [1]],
      ]);
      const action = { type: 'add_tag', tagIds: [1, 2] };

      const result = await ruleFilter.filterForAddTag(torrents, action, { tagsByDownloadId });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
      expect(getUserDb).not.toHaveBeenCalled();
    });

    it('falls back to DB when preloaded tag map is empty', async () => {
      const torrents = [{ id: '1', name: 'torrent' }];
      const action = { type: 'add_tag', tagIds: [1] };

      await ruleFilter.filterForAddTag(torrents, action, { tagsByDownloadId: new Map() });

      expect(getUserDb).toHaveBeenCalled();
    });
  });

  describe('filterForRemoveTag', () => {
    it('uses preloaded tags and skips torrents without any target tag', async () => {
      const torrents = [
        { id: '1', name: 'has tag' },
        { id: '2', name: 'no tag' },
      ];
      const tagsByDownloadId = new Map([
        ['1', [1]],
        ['2', [2]],
      ]);
      const action = { type: 'remove_tag', tagIds: [1] };

      const result = await ruleFilter.filterForRemoveTag(torrents, action, { tagsByDownloadId });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(getUserDb).not.toHaveBeenCalled();
    });

    it('falls back to DB when preloaded tag map is empty', async () => {
      const torrents = [{ id: '1', name: 'torrent' }];
      const action = { type: 'remove_tag', tagIds: [1] };

      await ruleFilter.filterForRemoveTag(torrents, action, { tagsByDownloadId: new Map() });

      expect(getUserDb).toHaveBeenCalled();
    });
  });
});

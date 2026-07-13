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
    it('loads tags from DB and skips torrents that already have all tags', async () => {
      const torrents = [
        { id: '1', name: 'has tags' },
        { id: '2', name: 'missing tags' },
      ];
      const tagsByDownloadId = new Map([
        ['1', [1, 2]],
        ['2', [1]],
      ]);
      const action = { type: 'add_tag', tagIds: [1, 2] };

      mockUserDb.prepare = mock((query) => ({
        all: mock(() =>
          [...tagsByDownloadId.entries()].flatMap(([downloadId, tagIds]) =>
            tagIds.map((tagId) => ({ download_id: downloadId, tag_id: tagId }))
          )
        ),
      }));

      const result = await ruleFilter.filterForAddTag(torrents, action, { tagsByDownloadId });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
      expect(getUserDb).toHaveBeenCalled();
    });

    it('treats string and numeric tag ids as equivalent when skipping already-tagged torrents', async () => {
      const torrents = [{ id: '1', name: 'has tags' }];
      const action = { type: 'add_tag', tagIds: [1] };

      mockUserDb.prepare = mock(() => ({
        all: mock(() => [{ download_id: '1', tag_id: '1' }]),
      }));

      const result = await ruleFilter.filterForAddTag(torrents, action);

      expect(result).toHaveLength(0);
    });

    it('queries DB when preloaded tag map is empty', async () => {
      const torrents = [{ id: '1', name: 'torrent' }];
      const action = { type: 'add_tag', tagIds: [1] };

      await ruleFilter.filterForAddTag(torrents, action, { tagsByDownloadId: new Map() });

      expect(getUserDb).toHaveBeenCalled();
    });
  });

  describe('filterForRemoveTag', () => {
    it('loads tags from DB and keeps torrents that have a target tag', async () => {
      const torrents = [
        { id: '1', name: 'has tag' },
        { id: '2', name: 'no tag' },
      ];
      const tagsByDownloadId = new Map([
        ['1', [1]],
        ['2', [2]],
      ]);
      const action = { type: 'remove_tag', tagIds: [1] };

      mockUserDb.prepare = mock(() => ({
        all: mock(() =>
          [...tagsByDownloadId.entries()].flatMap(([downloadId, tagIds]) =>
            tagIds.map((tagId) => ({ download_id: downloadId, tag_id: tagId }))
          )
        ),
      }));

      const result = await ruleFilter.filterForRemoveTag(torrents, action, { tagsByDownloadId });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(getUserDb).toHaveBeenCalled();
    });

    it('queries DB when preloaded tag map is empty', async () => {
      const torrents = [{ id: '1', name: 'torrent' }];
      const action = { type: 'remove_tag', tagIds: [1] };

      await ruleFilter.filterForRemoveTag(torrents, action, { tagsByDownloadId: new Map() });

      expect(getUserDb).toHaveBeenCalled();
    });
  });

  describe('airlock filters', () => {
    it('filterForAddAirlock skips downloads that are already airlocked', async () => {
      const torrents = [
        { id: '1', name: 'locked', airlocked: true },
        { id: '2', name: 'unlocked', airlocked: false },
      ];

      const result = await ruleFilter.filterForAddAirlock(torrents, { type: 'add_airlock' });

      expect(result).toEqual([{ id: '2', name: 'unlocked', airlocked: false }]);
    });

    it('filterForRemoveAirlock skips downloads that are not airlocked', async () => {
      const torrents = [
        { id: '1', name: 'locked', airlocked: true },
        { id: '2', name: 'unlocked', airlocked: false },
      ];

      const result = await ruleFilter.filterForRemoveAirlock(torrents, {
        type: 'remove_airlock',
      });

      expect(result).toEqual([{ id: '1', name: 'locked', airlocked: true }]);
    });
  });
});

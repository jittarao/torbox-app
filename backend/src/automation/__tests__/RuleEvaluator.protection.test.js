import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import RuleEvaluator from '../RuleEvaluator.js';
import { up } from '../../database/migrations/user/020_protected_downloads_schema.js';

describe('RuleEvaluator protection', () => {
  /** @type {import('bun:sqlite').Database} */
  let db;
  /** @type {RuleEvaluator} */
  let ruleEvaluator;
  /** @type {{ deleteDownload: ReturnType<typeof mock> }} */
  let mockApiClient;

  beforeEach(() => {
    db = new Database(':memory:');
    up(db);
    db.prepare('INSERT INTO protected_downloads (download_id) VALUES (?)').run('protected-1');

    mockApiClient = {
      controlTorrent: mock(() => Promise.resolve({ success: true })),
      deleteDownload: mock(() => Promise.resolve({ success: true })),
      deleteTorrent: mock(() => Promise.resolve({ success: true })),
      setAirlock: mock(() => Promise.resolve({ success: true })),
    };

    ruleEvaluator = new RuleEvaluator(db, mockApiClient);
  });

  test('skips delete for protected download', async () => {
    const result = await ruleEvaluator.executeAction(
      { type: 'delete' },
      { id: 'protected-1', assetType: 'torrent' }
    );

    expect(result).toMatchObject({
      applied: false,
      skipped: true,
      reason: 'protected',
    });
    expect(mockApiClient.deleteDownload).not.toHaveBeenCalled();
  });

  test('skips stop_seeding for protected download', async () => {
    const result = await ruleEvaluator.executeAction(
      { type: 'stop_seeding' },
      { id: 'protected-1', assetType: 'torrent' }
    );

    expect(result.reason).toBe('protected');
    expect(mockApiClient.controlTorrent).not.toHaveBeenCalled();
  });

  test('allows add_tag on protected download', async () => {
    db.prepare('CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT UNIQUE)').run();
    db.prepare(
      'CREATE TABLE download_tags (id INTEGER PRIMARY KEY, tag_id INTEGER, download_id TEXT, UNIQUE(tag_id, download_id))'
    ).run();
    db.prepare('INSERT INTO tags (id, name) VALUES (1, ?)').run('keep');

    const result = await ruleEvaluator.executeAction(
      { type: 'add_tag', tagIds: [1] },
      { id: 'protected-1', assetType: 'torrent' }
    );

    expect(result.success).toBe(true);
  });

  test('skips archive for protected download', async () => {
    const result = await ruleEvaluator.executeAction(
      { type: 'archive' },
      { id: 'protected-1', assetType: 'torrent', hash: 'abc' }
    );

    expect(result).toMatchObject({
      applied: false,
      skipped: true,
      reason: 'protected',
    });
  });

  test('delete proceeds after unprotect', async () => {
    db.prepare('DELETE FROM protected_downloads WHERE download_id = ?').run('protected-1');

    await ruleEvaluator.executeAction(
      { type: 'delete' },
      { id: 'protected-1', assetType: 'torrent' }
    );

    expect(mockApiClient.deleteDownload).toHaveBeenCalled();
  });
});

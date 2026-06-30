import { describe, it, expect } from 'bun:test';
import AutomationEngine from '../AutomationEngine.js';

describe('AutomationEngine changed-only scope', () => {
  const engine = new AutomationEngine(
    'test-auth',
    'encrypted',
    { getUserDatabase: async () => ({ db: null }) },
    null,
    {}
  );

  const inactiveTorrent = {
    id: '42',
    name: 'stale inactive',
    active: false,
    download_present: false,
    download_finished: true,
    assetType: 'torrent',
  };

  it('_buildChangedOnlySubset returns empty when there are no new items or transitions', () => {
    const subset = engine._buildChangedOnlySubset([inactiveTorrent], {
      new: [],
      stateTransitions: [],
    });
    expect(subset).toEqual([]);
  });

  it('_buildChangedOnlySubset includes torrents with state transitions', () => {
    const subset = engine._buildChangedOnlySubset([inactiveTorrent], {
      new: [],
      stateTransitions: [{ torrent_id: '42' }],
    });
    expect(subset).toHaveLength(1);
    expect(subset[0].id).toBe('42');
  });
});

import { describe, expect, test, mock, beforeEach } from 'bun:test';
import torboxApiOutageCoordinator from '../TorboxApiOutageCoordinator.js';
import ApiClient from '../ApiClient.js';

describe('ApiClient.setAirlock', () => {
  beforeEach(() => {
    torboxApiOutageCoordinator.resetForTests();
  });

  function createClientWithMocks(getImpl, putImpl) {
    const client = new ApiClient('test-api-key', { authId: 'user-1' });
    client.client = {
      get: mock(getImpl),
      put: mock(putImpl),
    };
    return client;
  }

  test('fetches fresh download before edit for torrent', async () => {
    const putBodies = [];
    const client = createClientWithMocks(
      async (endpoint, config) => {
        expect(endpoint).toBe('/api/torrents/mylist');
        expect(config.params).toEqual({ id: 'torrent-1', bypass_cache: true });
        return {
          data: {
            success: true,
            data: {
              id: 'torrent-1',
              name: 'Live name',
              tags: ['keep'],
              alternative_hashes: ['abc'],
              airlocked: false,
            },
          },
        };
      },
      async (endpoint, body) => {
        expect(endpoint).toBe('/api/torrents/edittorrent');
        putBodies.push(body);
        return { data: { success: true } };
      }
    );

    await client.setAirlock(
      {
        id: 'torrent-1',
        assetType: 'torrent',
        name: 'Stale name',
        tags: [],
        airlocked: false,
      },
      true
    );

    expect(putBodies).toHaveLength(1);
    expect(putBodies[0]).toEqual({
      torrent_id: 'torrent-1',
      name: 'Live name',
      tags: ['keep'],
      alternative_hashes: ['abc'],
      airlocked: true,
    });
  });

  test('uses usenet edit endpoint and id field', async () => {
    const putBodies = [];
    const client = createClientWithMocks(
      async () => ({
        data: {
          success: true,
          data: [{ id: 55, name: 'Usenet item', tags: [], alternativeHashes: ['h1'] }],
        },
      }),
      async (endpoint, body) => {
        expect(endpoint).toBe('/api/usenet/editusenetdownload');
        putBodies.push(body);
        return { data: { success: true } };
      }
    );

    await client.setAirlock({ id: 55, assetType: 'usenet' }, false);

    expect(putBodies[0]).toEqual({
      usenet_id: 55,
      name: 'Usenet item',
      tags: [],
      alternative_hashes: ['h1'],
      airlocked: false,
    });
  });

  test('uses webdl edit endpoint and id field', async () => {
    const putBodies = [];
    const client = createClientWithMocks(
      async () => ({
        data: {
          success: true,
          data: { id: 'web-9', name: 'Web download', tags: ['x'] },
        },
      }),
      async (endpoint, body) => {
        expect(endpoint).toBe('/api/webdl/editwebdownload');
        putBodies.push(body);
        return { data: { success: true } };
      }
    );

    await client.setAirlock({ id: 'web-9', assetType: 'webdl' }, true);

    expect(putBodies[0]).toEqual({
      webdl_id: 'web-9',
      name: 'Web download',
      tags: ['x'],
      alternative_hashes: [],
      airlocked: true,
    });
  });

  test('throws when download is missing from list response', async () => {
    const client = createClientWithMocks(
      async () => ({
        data: { success: true, data: [] },
      }),
      async () => ({ data: { success: true } })
    );

    await expect(client.setAirlock({ id: 'missing', assetType: 'torrent' }, true)).rejects.toThrow(
      'Download not found'
    );
  });
});

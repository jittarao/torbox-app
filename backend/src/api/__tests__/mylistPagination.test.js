import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import {
  MYLIST_PAGE_LIMIT,
  fetchAllMyListPages,
  fetchFirstMyListPage,
  fetchMyList,
  isTorboxMylistFullPaginationEnabled,
  mergeMyListWithQueued,
} from '../mylistPagination.js';

const ENV_KEY = 'TORBOX_MYLIST_FULL_PAGINATION';

describe('mylistPagination', () => {
  let previousEnv;

  beforeEach(() => {
    previousEnv = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (previousEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = previousEnv;
    }
  });

  it('isTorboxMylistFullPaginationEnabled defaults to false', () => {
    expect(isTorboxMylistFullPaginationEnabled()).toBe(false);
  });

  it('isTorboxMylistFullPaginationEnabled accepts true and 1', () => {
    process.env[ENV_KEY] = 'true';
    expect(isTorboxMylistFullPaginationEnabled()).toBe(true);
    process.env[ENV_KEY] = '1';
    expect(isTorboxMylistFullPaginationEnabled()).toBe(true);
  });

  it('fetchFirstMyListPage requests only bypass_cache (legacy single page)', async () => {
    const calls = [];
    const client = {
      get: async (endpoint, config) => {
        calls.push({ endpoint, params: config.params });
        return { data: { data: [{ id: 1 }] } };
      },
    };

    const result = await fetchFirstMyListPage({
      client,
      endpoint: '/api/torrents/mylist',
      bypassCache: true,
    });

    expect(result.pageCount).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual({ bypass_cache: true });
    expect(calls[0].params.offset).toBeUndefined();
    expect(calls[0].params.limit).toBeUndefined();
  });

  it('fetchMyList uses first page by default', async () => {
    const client = {
      get: async (_endpoint, config) => {
        expect(config.params.offset).toBeUndefined();
        return { data: { data: [{ id: 1 }] } };
      },
    };

    await fetchMyList({ client, endpoint: '/api/torrents/mylist' });
  });

  it('fetchMyList paginates when TORBOX_MYLIST_FULL_PAGINATION is enabled', async () => {
    process.env[ENV_KEY] = 'true';
    const page0 = Array.from({ length: MYLIST_PAGE_LIMIT }, (_, i) => ({ id: i + 1 }));
    const page1 = [{ id: MYLIST_PAGE_LIMIT + 1 }];

    const client = {
      get: async (_endpoint, { params }) => {
        if (params.offset === 0) return { data: { data: page0 } };
        if (params.offset === MYLIST_PAGE_LIMIT) return { data: { data: page1 } };
        throw new Error(`unexpected offset ${params.offset}`);
      },
    };

    const result = await fetchMyList({ client, endpoint: '/api/torrents/mylist' });
    expect(result.pageCount).toBe(2);
    expect(result.items).toHaveLength(MYLIST_PAGE_LIMIT + 1);
  });

  it('fetchAllMyListPages stops after a short final page', async () => {
    const page0 = Array.from({ length: MYLIST_PAGE_LIMIT }, (_, i) => ({ id: i + 1 }));
    const page1 = [{ id: MYLIST_PAGE_LIMIT + 1 }];

    const client = {
      get: async (_endpoint, { params }) => {
        if (params.offset === 0) return { data: { data: page0 } };
        if (params.offset === MYLIST_PAGE_LIMIT) return { data: { data: page1 } };
        throw new Error(`unexpected offset ${params.offset}`);
      },
    };

    const result = await fetchAllMyListPages({
      client,
      endpoint: '/api/torrents/mylist',
      bypassCache: true,
    });

    expect(result.pageCount).toBe(2);
    expect(result.items).toHaveLength(MYLIST_PAGE_LIMIT + 1);
    expect(result.items.find((row) => row.id === MYLIST_PAGE_LIMIT + 1)).toBeTruthy();
  });

  it('fetchAllMyListPages deduplicates duplicate ids across pages', async () => {
    const page0 = Array.from({ length: MYLIST_PAGE_LIMIT }, (_, i) => ({
      id: i + 1,
      name: `item-${i + 1}`,
    }));
    const page1 = [{ id: MYLIST_PAGE_LIMIT, name: 'updated-tail' }];

    const client = {
      get: async (_endpoint, { params }) => {
        if (params.offset === 0) return { data: { data: page0 } };
        if (params.offset === MYLIST_PAGE_LIMIT) return { data: { data: page1 } };
        throw new Error(`unexpected offset ${params.offset}`);
      },
    };

    const result = await fetchAllMyListPages({
      client,
      endpoint: '/api/torrents/mylist',
    });

    expect(result.items.find((row) => row.id === MYLIST_PAGE_LIMIT)?.name).toBe('updated-tail');
  });

  it('mergeMyListWithQueued prefers mylist rows over queued duplicates', () => {
    const merged = mergeMyListWithQueued(
      [{ id: 1, active: false }],
      [
        { id: 1, active: true },
        { id: 2, active: true },
      ],
      (item, options = {}) => ({
        ...item,
        ...(options.queued ? { status: 'queued' } : {}),
      })
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((row) => row.id === 1)?.status).toBeUndefined();
    expect(merged.find((row) => row.id === 2)?.status).toBe('queued');
  });
});

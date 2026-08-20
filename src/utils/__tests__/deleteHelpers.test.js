import { describe, expect, test, mock, afterEach } from 'bun:test';

describe('batchDeleteHelper', () => {
  afterEach(() => {
    mock.restore();
  });

  test('calls DELETE per entry with queued flag from client', async () => {
    const fetchCalls = [];

    mock.module('@/utils/retryFetch', () => ({
      retryFetch: async (url, options) => {
        fetchCalls.push({ url, body: options.body });
        return { success: true };
      },
    }));

    const { batchDeleteHelper } = await import('../deleteHelpers.js');
    const result = await batchDeleteHelper(
      [
        { id: 2, queued: false },
        { id: 3, queued: true },
      ],
      'test-key',
      'torrents'
    );

    expect(result).toEqual([2, 3]);
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0].url).toBe('/api/torrents');
    expect(fetchCalls[0].body).toEqual({ id: 2, queued: false });
    expect(fetchCalls[1].body).toEqual({ id: 3, queued: true });
  });

  test('invokes onItemComplete for each entry', async () => {
    const completions = [];

    mock.module('@/utils/retryFetch', () => ({
      retryFetch: async (_url, options) => {
        const id = options.body.id;
        return id === 2 ? { success: true } : { success: false, error: 'failed' };
      },
    }));

    const { batchDeleteHelper } = await import('../deleteHelpers.js');
    const result = await batchDeleteHelper(
      [
        { id: 2, queued: false },
        { id: 3, queued: false },
      ],
      'test-key',
      'torrents',
      {
        onItemComplete: (entry) => completions.push(entry),
      }
    );

    expect(result).toEqual([2]);
    expect(completions).toEqual([
      { id: 2, success: true },
      { id: 3, success: false, error: 'failed' },
    ]);
  });
});

describe('deleteEntryFromItem', () => {
  test('maps status queued to delete entry', async () => {
    const { deleteEntryFromItem } = await import('../deleteHelpers.js');
    expect(deleteEntryFromItem({ id: 1, status: 'queued' })).toEqual({ id: 1, queued: true });
    expect(deleteEntryFromItem({ id: 2, status: 'completed' })).toEqual({ id: 2, queued: false });
  });
});

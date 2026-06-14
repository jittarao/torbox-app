import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';

function createPaginationState() {
  return { page: 1, limit: 50, total: 0, totalPages: 0 };
}

function createMockResponse() {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        success: true,
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      }),
  };
}

let fetchCalls;

mock.module('@/utils/fetch', () => ({
  default: mock((...args) => {
    fetchCalls += 1;
    return Promise.resolve(createMockResponse());
  }),
}));

const { useArchive } = await import('@/hooks/useArchive');

describe('useArchive', () => {
  beforeEach(() => {
    fetchCalls = 0;
  });

  it('loads archived downloads once on mount', async () => {
    const { result } = renderHook(() => {
      const [pagination, setPagination] = useState(createPaginationState);
      return useArchive('test-api-key', pagination, setPagination, '');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchCalls).toBe(1);
  });

  it('does not refetch when pagination totals are unchanged', async () => {
    const { result, rerender } = renderHook(() => {
      const [pagination, setPagination] = useState(createPaginationState);
      return useArchive('test-api-key', pagination, setPagination, '');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchCalls).toBe(1);
    rerender();
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(fetchCalls).toBe(1);
  });
});

import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useArchive } from '@/hooks/useArchive';

function createPaginationState() {
  return { page: 1, limit: 50, total: 0, totalPages: 0 };
}

describe('useArchive', () => {
  let fetchCalls;

  beforeEach(() => {
    fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        }),
      };
    };
  });

  afterEach(() => {
    delete globalThis.fetch;
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

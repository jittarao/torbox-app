import { useState, useEffect, useCallback, useRef } from 'react';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import { resetFlagsIfRequestCurrent } from '@/utils/asyncLoadingReset';
import { useBackendMode } from '@/hooks/useBackendMode';
import { mergeListWithStructuralSharing } from '@/utils/listStructuralMerge';
import { normalizeUploadId } from '../utils';

function mergePaginationTotals(prev, next) {
  if (prev.total === next.total && prev.totalPages === next.totalPages) {
    return prev;
  }
  return {
    ...prev,
    total: next.total,
    totalPages: next.totalPages,
  };
}

export function useUploads(apiKey, activeTab, filters, pagination, setPagination) {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const uploadsLengthRef = useRef(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [uploadStatistics, setUploadStatistics] = useState(null);
  const uploadsRequestIdRef = useRef(0);
  const statusCountsRequestIdRef = useRef(0);
  const listQueryRef = useRef({
    activeTab,
    type: filters.type,
    search: filters.search,
  });

  // Subscribe to backend mode store to react to changes
  const { mode: backendMode, isLoading: backendIsLoading } = useBackendMode();

  const fetchUploads = useCallback(
    async ({ silent = false } = {}) => {
      if (!apiKey) return;

      // Wait for backend check to complete before deciding
      if (backendIsLoading) {
        return;
      }

      // Check if backend is available
      if (backendMode !== 'backend') {
        setUploads([]);
        setLoading(false);
        setError(null);
        setPagination((prev) => ({
          ...prev,
          total: 0,
          totalPages: 0,
        }));
        return;
      }

      const requestId = ++uploadsRequestIdRef.current;
      const queryChanged =
        listQueryRef.current.activeTab !== activeTab ||
        listQueryRef.current.type !== filters.type ||
        listQueryRef.current.search !== filters.search;

      if (queryChanged) {
        listQueryRef.current = {
          activeTab,
          type: filters.type,
          search: filters.search,
        };
        setUploads([]);
        setError(null);
        uploadsLengthRef.current = 0;
      }

      const showFullPageLoader = uploadsLengthRef.current === 0;
      try {
        if (showFullPageLoader) {
          setLoading(true);
        } else if (!silent) {
          setRefreshing(true);
        }
        setError(null);

        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          status: activeTab,
        });
        if (filters.type) params.append('type', filters.type);
        if (filters.search) params.append('search', filters.search);

        const response = await fetch(`/api/uploads?${params.toString()}`, {
          headers: {
            'x-api-key': apiKey,
          },
        });

        if (requestId !== uploadsRequestIdRef.current) {
          return;
        }

        const { ok: responseOk, data } = await readJsonFromResponse(response);

        if (requestId !== uploadsRequestIdRef.current) {
          return;
        }

        if (!responseOk) {
          throw new Error(data.error || 'Failed to fetch uploads');
        }

        setUploads((prev) =>
          mergeListWithStructuralSharing(prev, data.data || [], (row) => normalizeUploadId(row.id))
        );
        setPagination((prev) =>
          mergePaginationTotals(prev, {
            total: data.pagination?.total || 0,
            totalPages: data.pagination?.totalPages || 0,
          })
        );

        // Update status counts if provided
        if (data.statusCounts) {
          setStatusCounts(data.statusCounts);
        }

        // Update upload statistics if provided
        if (data.uploadStatistics) {
          setUploadStatistics(data.uploadStatistics);
        }
      } catch (err) {
        if (requestId === uploadsRequestIdRef.current) {
          setError(err.message);
          console.error('Error fetching uploads:', err);
        }
      } finally {
        resetFlagsIfRequestCurrent(requestId, uploadsRequestIdRef, setLoading, setRefreshing);
      }
    },
    [
      apiKey,
      pagination.page,
      pagination.limit,
      activeTab,
      filters.type,
      filters.search,
      setPagination,
      backendMode,
      backendIsLoading,
    ]
  );

  // Fetch status counts separately when tab changes
  const fetchStatusCounts = useCallback(async () => {
    if (!apiKey) return;

    // Wait for backend check to complete before deciding
    if (backendIsLoading) {
      return;
    }

    // Check if backend is available
    if (backendMode !== 'backend') {
      setStatusCounts({});
      setUploadStatistics(null);
      return;
    }

    const requestId = ++statusCountsRequestIdRef.current;
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);

      const response = await fetch(`/api/uploads?${params.toString()}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (requestId !== statusCountsRequestIdRef.current) {
        return;
      }

      const { ok: responseOk, data } = await readJsonFromResponse(response);

      if (requestId !== statusCountsRequestIdRef.current) {
        return;
      }

      if (!responseOk) {
        return;
      }

      if (data.statusCounts) {
        setStatusCounts(data.statusCounts);
      }

      if (data.uploadStatistics) {
        setUploadStatistics(data.uploadStatistics);
      }
    } catch (err) {
      console.error('Error fetching status counts:', err);
    }
  }, [apiKey, filters.type, backendMode, backendIsLoading]);

  useEffect(() => {
    uploadsLengthRef.current = uploads.length;
  }, [uploads]);

  useEffect(() => {
    fetchUploads();
    // Auto-refresh every 1 minute (silent — keep table mounted, no overlay)
    const interval = setInterval(() => {
      fetchUploads({ silent: true });
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchUploads]);

  return {
    uploads,
    setUploads,
    loading,
    refreshing,
    error,
    statusCounts,
    uploadStatistics,
    fetchUploads,
    fetchStatusCounts,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { useBackendModeStore } from '@/store/backendModeStore';

export function useUploads(apiKey, activeTab, filters, pagination, setPagination) {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusCounts, setStatusCounts] = useState({});
  const [uploadStatistics, setUploadStatistics] = useState(null);

  // Subscribe to backend mode store to react to changes
  const { mode: backendMode, isLoading: backendIsLoading } = useBackendModeStore();

  const fetchUploads = useCallback(async () => {
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

    try {
      setLoading(true);
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch uploads');
      }

      setUploads(data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      }));

      // Update status counts if provided
      if (data.statusCounts) {
        setStatusCounts(data.statusCounts);
      }

      // Update upload statistics if provided
      if (data.uploadStatistics) {
        setUploadStatistics(data.uploadStatistics);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching uploads:', err);
    } finally {
      setLoading(false);
    }
  }, [
    apiKey,
    pagination.page,
    pagination.limit,
    activeTab,
    filters.type,
    filters.search,
    setPagination,
    backendMode,
    backendIsLoading,
  ]);

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

    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);

      const response = await fetch(`/api/uploads?${params.toString()}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      const data = await response.json();

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
    fetchUploads();
    fetchStatusCounts();
    // Auto-refresh every 1 minute
    const interval = setInterval(() => {
      fetchUploads();
      fetchStatusCounts();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchUploads, fetchStatusCounts]);

  return {
    uploads,
    setUploads,
    loading,
    error,
    statusCounts,
    uploadStatistics,
    fetchUploads,
    fetchStatusCounts,
  };
}

import { useState, useEffect, useCallback } from 'react';

export function useLinkHistory(apiKey, pagination, setPagination, search = '') {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLinkHistory = useCallback(async () => {
    if (!apiKey) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.append('search', search);

      const response = await fetch(`/api/link-history?${params.toString()}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch link history');
      }

      setHistory(data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      }));
    } catch (err) {
      setError(err.message);
      console.error('Error fetching link history:', err);
    } finally {
      setLoading(false);
    }
  }, [apiKey, pagination.page, pagination.limit, search, setPagination]);

  useEffect(() => {
    fetchLinkHistory();
    // Auto-refresh every 1 minute
    const interval = setInterval(() => {
      fetchLinkHistory();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchLinkHistory]);

  return {
    history,
    setHistory,
    loading,
    error,
    fetchLinkHistory,
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';

export function useCustomViews(apiKey) {
  const [views, setViews] = useState([]);
  const [activeView, setActiveView] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadViews = useCallback(async () => {
    if (!apiKey) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/custom-views', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load views');
      }

      const data = await response.json();
      if (data.success) {
        setViews(data.views || []);
      } else {
        throw new Error(data.error || 'Failed to load views');
      }
    } catch (err) {
      console.error('Error loading views:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const saveView = useCallback(async (name, filters, sort, columns, assetType = null) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/custom-views', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          filters,
          sort_field: sort?.field || null,
          sort_direction: sort?.direction || null,
          visible_columns: columns || null,
          asset_type: assetType || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save view');
      }

      const data = await response.json();
      if (data.success) {
        await loadViews();
        return data.view;
      } else {
        throw new Error(data.error || 'Failed to save view');
      }
    } catch (err) {
      console.error('Error saving view:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiKey, loadViews]);

  const updateView = useCallback(async (id, updates) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/custom-views/${id}`, {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update view');
      }

      const data = await response.json();
      if (data.success) {
        await loadViews();
        // Update active view if it's the one being updated
        if (activeView?.id === id) {
          setActiveView(data.view);
        }
        return data.view;
      } else {
        throw new Error(data.error || 'Failed to update view');
      }
    } catch (err) {
      console.error('Error updating view:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiKey, loadViews, activeView]);

  const deleteView = useCallback(async (id) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/custom-views/${id}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete view');
      }

      const data = await response.json();
      if (data.success) {
        await loadViews();
        // Clear active view if it's the one being deleted
        if (activeView?.id === id) {
          setActiveView(null);
        }
        return true;
      } else {
        throw new Error(data.error || 'Failed to delete view');
      }
    } catch (err) {
      console.error('Error deleting view:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiKey, loadViews, activeView]);

  const applyView = useCallback((view) => {
    setActiveView(view);
  }, []);

  const clearView = useCallback(() => {
    setActiveView(null);
  }, []);

  // Load views on mount and when apiKey changes
  useEffect(() => {
    if (apiKey) {
      loadViews();
    }
  }, [apiKey, loadViews]);

  return {
    views,
    activeView,
    loading,
    error,
    loadViews,
    saveView,
    updateView,
    deleteView,
    applyView,
    clearView,
  };
}

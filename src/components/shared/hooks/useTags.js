'use client';

import { useState, useEffect, useCallback } from 'react';

export function useTags(apiKey) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTags = useCallback(async () => {
    if (!apiKey) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tags', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load tags');
      }

      const data = await response.json();
      if (data.success) {
        setTags(data.tags || []);
      } else {
        throw new Error(data.error || 'Failed to load tags');
      }
    } catch (err) {
      console.error('Error loading tags:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const createTag = useCallback(async (name) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create tag');
      }

      const data = await response.json();
      if (data.success) {
        await loadTags();
        return data.tag;
      } else {
        throw new Error(data.error || 'Failed to create tag');
      }
    } catch (err) {
      console.error('Error creating tag:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiKey, loadTags]);

  const updateTag = useCallback(async (id, name) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update tag');
      }

      const data = await response.json();
      if (data.success) {
        await loadTags();
        return data.tag;
      } else {
        throw new Error(data.error || 'Failed to update tag');
      }
    } catch (err) {
      console.error('Error updating tag:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiKey, loadTags]);

  const deleteTag = useCallback(async (id) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete tag');
      }

      const data = await response.json();
      if (data.success) {
        await loadTags();
        return true;
      } else {
        throw new Error(data.error || 'Failed to delete tag');
      }
    } catch (err) {
      console.error('Error deleting tag:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiKey, loadTags]);

  // Load tags on mount and when apiKey changes
  useEffect(() => {
    if (apiKey) {
      loadTags();
    }
  }, [apiKey, loadTags]);

  return {
    tags,
    loading,
    error,
    loadTags,
    createTag,
    updateTag,
    deleteTag,
  };
}

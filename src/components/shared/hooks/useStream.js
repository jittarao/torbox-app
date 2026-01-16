'use client';

import { useState } from 'react';

/**
 * Hook for managing TorBox stream API calls
 * @param {string} apiKey - TorBox API key
 * @returns {Object} - Stream functions and state
 */
export function useStream(apiKey) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Creates a stream and returns metadata
   * @param {number} itemId - Download ID
   * @param {number} fileId - File ID
   * @param {string} type - Type: 'torrent', 'usenet', or 'webdownload'
   * @param {number|null} subtitleIndex - Subtitle index (null for none, 0 for first)
   * @param {number} audioIndex - Audio index (0 for first, required)
   * @returns {Promise<Object>} - Stream metadata including presigned_token, token, and available tracks
   */
  const createStream = async (itemId, fileId, type, subtitleIndex = null, audioIndex = 0) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        id: itemId.toString(),
        file_id: fileId.toString(),
        type: type,
        chosen_audio_index: audioIndex.toString(),
      });

      // Always send subtitle index if it's a number (0 or greater)
      // Note: If subtitleIndex is null/undefined, we don't send the parameter
      // This means "no subtitle" - the API will use default behavior
      if (subtitleIndex !== null && subtitleIndex !== undefined) {
        params.append('chosen_subtitle_index', subtitleIndex.toString());
      }

      const response = await fetch(`/api/stream/createstream?${params}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create stream: ${response.status}`);
      }

      const data = await response.json();

      // Check if response indicates success
      if (data.success === false) {
        throw new Error(data.error || 'Failed to create stream');
      }

      return data;
    } catch (err) {
      const errorMessage = err.message || 'Failed to create stream';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Gets stream data (URL) or metadata from a stream
   * Can be called with either:
   * - Option 1: presignedToken and token (for existing stream)
   * - Option 2: itemId, fileId, and type (to get metadata without creating stream)
   * @param {string|number} presignedTokenOrItemId - Presigned token OR itemId
   * @param {string|number} tokenOrFileId - Token OR fileId
   * @param {number|null|string} subtitleIndexOrType - Subtitle index OR stream type ('torrent', 'usenet', 'webdownload')
   * @param {number} audioIndex - Audio index (0 for first, only used with tokens)
   * @returns {Promise<Object>} - Stream data including metadata and stream URL
   */
  const getStreamData = async (
    presignedTokenOrItemId,
    tokenOrFileId,
    subtitleIndexOrType = null,
    audioIndex = 0
  ) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Determine if we're using tokens (string) or itemId/fileId (number)
      const isTokenMode =
        typeof presignedTokenOrItemId === 'string' && typeof tokenOrFileId === 'string';

      let params;
      if (isTokenMode) {
        // Original mode: using presignedToken and token
        params = new URLSearchParams({
          presigned_token: presignedTokenOrItemId,
          token: tokenOrFileId,
          chosen_audio_index: audioIndex.toString(),
        });

        if (subtitleIndexOrType !== null && subtitleIndexOrType !== undefined) {
          params.append('chosen_subtitle_index', subtitleIndexOrType.toString());
        }
      } else {
        // New mode: using itemId, fileId, and type to get metadata
        params = new URLSearchParams({
          id: presignedTokenOrItemId.toString(),
          file_id: tokenOrFileId.toString(),
          type: subtitleIndexOrType || 'torrent',
        });
      }

      const response = await fetch(`/api/stream/getstreamdata?${params}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to get stream data: ${response.status}`);
      }

      const data = await response.json();

      // Check if response indicates success
      if (data.success === false) {
        throw new Error(data.error || 'Failed to get stream data');
      }

      return data;
    } catch (err) {
      const errorMessage = err.message || 'Failed to get stream data';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createStream,
    getStreamData,
    isLoading,
    error,
  };
}

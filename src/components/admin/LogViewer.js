'use client';

import { useState, useEffect, useRef } from 'react';
import adminApiClient from '@/utils/adminApiClient';

export default function LogViewer() {
  const [container, setContainer] = useState('torbox-backend');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [tail, setTail] = useState(100);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef(null);
  const streamCleanupRef = useRef(null);

  const scrollToBottom = () => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs, autoScroll]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiClient.getLogs({ container, tail });
      if (result.success) {
        setLogs(result.logs || []);
      } else {
        setError(result.error || 'Failed to load logs');
      }
    } catch (err) {
      setError(err.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const startStreaming = () => {
    if (streaming) {
      // Stop streaming
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
        streamCleanupRef.current = null;
      }
      setStreaming(false);
      return;
    }

    setStreaming(true);
    setError(null);

    // Load initial logs
    loadLogs();

    // Start streaming
    const cleanup = adminApiClient.streamLogs(
      { container, tail },
      (data) => {
        if (data.type === 'log') {
          setLogs((prev) => {
            const newLogs = [...prev, data.line];
            // Keep only last 1000 lines to prevent memory issues
            return newLogs.slice(-1000);
          });
        } else if (data.type === 'error') {
          setError(data.error);
        } else if (data.type === 'closed') {
          setStreaming(false);
        }
      },
      (err) => {
        setError(err.message || 'Streaming error');
        setStreaming(false);
      }
    );

    streamCleanupRef.current = cleanup;
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
      }
    };
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  const formatLogLine = (line) => {
    // Try to parse JSON logs (Winston format)
    try {
      const parsed = JSON.parse(line);
      const timestamp = parsed.timestamp || parsed.time || '';
      const level = parsed.level || '';
      const message = parsed.message || '';
      const meta = { ...parsed };
      delete meta.timestamp;
      delete meta.time;
      delete meta.level;
      delete meta.message;
      delete meta.service;
      delete meta.version;

      return {
        timestamp,
        level,
        message,
        meta: Object.keys(meta).length > 0 ? meta : null,
        raw: line
      };
    } catch {
      // Not JSON, return as plain text
      return {
        timestamp: null,
        level: null,
        message: line,
        meta: null,
        raw: line
      };
    }
  };

  const getLevelColor = (level) => {
    if (!level) return 'text-gray-600 dark:text-gray-400';
    const lower = level.toLowerCase();
    if (lower.includes('error') || lower.includes('fatal')) {
      return 'text-red-600 dark:text-red-400';
    }
    if (lower.includes('warn')) {
      return 'text-yellow-600 dark:text-yellow-400';
    }
    if (lower.includes('info')) {
      return 'text-blue-600 dark:text-blue-400';
    }
    if (lower.includes('debug')) {
      return 'text-gray-500 dark:text-gray-500';
    }
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Container
            </label>
            <select
              value={container}
              onChange={(e) => {
                setContainer(e.target.value);
                if (streaming) {
                  // Restart streaming with new container
                  if (streamCleanupRef.current) {
                    streamCleanupRef.current();
                  }
                  setStreaming(false);
                  setTimeout(() => startStreaming(), 100);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="torbox-backend">torbox-backend</option>
              <option value="torbox-app">torbox-app</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tail (lines)
            </label>
            <input
              type="number"
              value={tail}
              onChange={(e) => setTail(parseInt(e.target.value, 10) || 100)}
              min="10"
              max="1000"
              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 items-end">
            <button
              onClick={loadLogs}
              disabled={loading || streaming}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Load Logs'}
            </button>
            <button
              onClick={startStreaming}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                streaming
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {streaming ? 'Stop Stream' : 'Start Stream'}
            </button>
            <button
              onClick={clearLogs}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
          {streaming && (
            <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
              Streaming...
            </span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Logs Display */}
      <div className="bg-gray-900 rounded-lg shadow border border-gray-700 overflow-hidden">
        <div className="h-[600px] overflow-y-auto p-4 font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-12">
              No logs loaded. Click "Load Logs" or "Start Stream" to view logs.
            </div>
          ) : (
            logs.map((line, index) => {
              const formatted = formatLogLine(line);
              return (
                <div
                  key={index}
                  className="mb-1 hover:bg-gray-800 rounded px-2 py-1"
                >
                  {formatted.timestamp && (
                    <span className="text-gray-500 dark:text-gray-500 mr-2">
                      {formatted.timestamp}
                    </span>
                  )}
                  {formatted.level && (
                    <span className={`mr-2 font-semibold ${getLevelColor(formatted.level)}`}>
                      [{formatted.level.toUpperCase()}]
                    </span>
                  )}
                  <span className="text-gray-100 dark:text-gray-200">
                    {formatted.message}
                  </span>
                  {formatted.meta && (
                    <details className="mt-1 ml-4">
                      <summary className="text-gray-400 dark:text-gray-500 cursor-pointer text-xs">
                        Metadata
                      </summary>
                      <pre className="mt-1 text-xs text-gray-400 dark:text-gray-500 overflow-x-auto">
                        {JSON.stringify(formatted.meta, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

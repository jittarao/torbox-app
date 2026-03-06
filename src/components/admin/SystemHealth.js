'use client';

import { useState } from 'react';
import adminApiClient from '@/utils/adminApiClient';

export default function SystemHealth({ metrics, onRefresh }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  const handleSyncRulesFlags = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const data = await adminApiClient.syncRulesFlags();
      const msg = data?.sync
        ? `Synced ${data.sync.synced} user flags in ${data.sync.durationSeconds?.toFixed(1) ?? '?'}s. Pollers: ${data.pollersAfterRefresh ?? '—'}`
        : 'Sync completed.';
      setSyncMessage({ type: 'success', text: msg });
      onRefresh?.();
    } catch (err) {
      setSyncMessage({ type: 'error', text: err.message || 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Database Health */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Database Health</h3>
        {metrics.database?.master_database && (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Master DB Size</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {metrics.database.master_database.size_formatted}
                </span>
              </div>
            </div>
            {metrics.database.connection_pool && (
              <>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400" title="Open SQLite connections to per-user databases (not the same as Active Pollers)">
                      Pool size (user DB connections)
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {metrics.database.connection_pool.size ?? metrics.database.connection_pool.currentSize} /{' '}
                      {metrics.database.connection_pool.maxSize}
                    </span>
                  </div>
                </div>
                {metrics.database.connection_pool.usagePercent != null && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Pool Usage</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {metrics.database.connection_pool.usagePercent}%
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Pool Status</span>
                    <span
                      className={`font-medium ${
                        metrics.database.connection_pool.status === 'healthy'
                          ? 'text-green-600 dark:text-green-400'
                          : metrics.database.connection_pool.status === 'warning'
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : metrics.database.connection_pool.status === 'critical'
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {metrics.database.connection_pool.status}
                    </span>
                  </div>
                    {!['healthy', 'warning'].includes(metrics.database.connection_pool.status) && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Many user DBs have an open connection. Consider increasing <code className="rounded bg-gray-100 dark:bg-gray-700 px-1">MAX_DB_CONNECTIONS</code> for 1000+ users.
                      </p>
                    )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Polling Scheduler */}
      {metrics.polling && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Polling Scheduler</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <span
                  className={`font-medium ${
                    metrics.polling.isRunning ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {metrics.polling.isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Active Pollers</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {metrics.polling.activePollers || 0}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Users with at least one enabled automation rule (separate from pool connections above).
              </p>
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleSyncRulesFlags}
                disabled={syncing}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? 'Syncing…' : 'Sync rules flags & refresh pollers'}
              </button>
              {syncMessage && (
                <p
                  className={`mt-2 text-sm ${
                    syncMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {syncMessage.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

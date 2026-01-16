'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import adminApiClient from '@/utils/adminApiClient';

export default function AdminSettingsPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await adminApiClient.getConfig();
        setConfig(result.config);
      } catch (error) {
        console.error('Error loading config:', error);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">System Configuration</h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading configuration...</p>
          </div>
        ) : config ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Polling Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Max Concurrent Polls
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {config.polling?.max_concurrent_polls}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Poll Timeout (ms)
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {config.polling?.poll_timeout_ms}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Cleanup Interval (hours)
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {config.polling?.poller_cleanup_interval_hours}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Rate Limiting
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      User Rate Limit
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {config.rate_limiting?.user_rate_limit_max}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Admin Rate Limit
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {config.rate_limiting?.admin_rate_limit_max}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Database Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Max Connections
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {config.database?.max_db_connections}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Master DB Path
                    </label>
                    <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white break-all">
                      {config.database?.master_db_path}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Configuration updates require environment variable changes
                  and server restart.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Failed to load configuration</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

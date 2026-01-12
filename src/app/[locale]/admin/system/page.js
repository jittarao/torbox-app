'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import adminApiClient from '@/utils/adminApiClient';
import SystemHealth from '@/components/admin/SystemHealth';
import PerformanceMetrics from '@/components/admin/PerformanceMetrics';

export default function AdminSystemPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadMetrics = async () => {
    try {
      const [overview, performance, database, polling] = await Promise.all([
        adminApiClient.getOverviewMetrics(),
        adminApiClient.getPerformanceMetrics(),
        adminApiClient.getDatabaseMetrics(),
        adminApiClient.getPollingMetrics(),
      ]);
      setMetrics({
        overview: overview.overview,
        performance: performance.performance,
        database: database,
        polling: polling.polling,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">System Health</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading system metrics...</p>
          </div>
        ) : metrics ? (
          <>
            <SystemHealth metrics={metrics} />
            <PerformanceMetrics metrics={metrics.performance} />
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Failed to load metrics</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

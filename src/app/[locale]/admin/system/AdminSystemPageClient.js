'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import adminApiClient from '@/utils/adminApiClient';
import SystemHealth from '@/components/admin/SystemHealth';
import PerformanceMetrics from '@/components/admin/PerformanceMetrics';
import { AdminEmpty, AdminLoading, AdminPageHeader } from '@/components/admin/AdminUi';

export default function AdminSystemPageClient() {
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
        <AdminPageHeader
          title="System health"
          description="Database pool, polling scheduler, and runtime performance."
          actions={
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-white px-3 py-2 text-sm text-muted dark:border-border-dark/60 dark:bg-surface-alt-dark dark:text-muted-dark">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="size-4 rounded border-border text-accent focus:ring-accent/30 dark:border-border-dark"
              />
              Auto-refresh (30s)
            </label>
          }
        />

        {loading ? (
          <AdminLoading label="Loading system metrics…" />
        ) : metrics ? (
          <>
            <SystemHealth metrics={metrics} onRefresh={loadMetrics} />
            <PerformanceMetrics metrics={metrics.performance} />
          </>
        ) : (
          <AdminEmpty message="Failed to load system metrics." />
        )}
      </div>
    </AdminLayout>
  );
}

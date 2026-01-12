'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import MetricCard from '@/components/admin/MetricCard';
import SystemOverview from '@/components/admin/SystemOverview';
import useAdminStore from '@/store/adminStore';
import Toast from '@/components/shared/Toast';

export default function AdminDashboard() {
  const { overviewMetrics, overviewLoading, fetchOverviewMetrics } = useAdminStore();
  const [toast, setToast] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchOverviewMetrics();
  }, [fetchOverviewMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchOverviewMetrics();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchOverviewMetrics]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
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

        {overviewLoading && !overviewMetrics ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading metrics...</p>
          </div>
        ) : overviewMetrics ? (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Users"
                value={overviewMetrics.users?.total || 0}
                subtitle={`${overviewMetrics.users?.active || 0} active`}
                icon="👥"
              />
              <MetricCard
                title="Active Rules"
                value={overviewMetrics.users?.with_active_rules || 0}
                subtitle="Users with automation"
                icon="🤖"
              />
              <MetricCard
                title="Automation Engines"
                value={overviewMetrics.automation_engines || 0}
                subtitle="Running engines"
                icon="⚙️"
              />
              <MetricCard
                title="Total DB Size"
                value={overviewMetrics.databases?.total_user_size_formatted || '0 MB'}
                subtitle={`${overviewMetrics.databases?.user_db_count || 0} databases`}
                icon="💾"
              />
            </div>

            {/* System Overview */}
            <SystemOverview metrics={overviewMetrics} />
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Failed to load metrics</p>
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AdminLayout>
  );
}

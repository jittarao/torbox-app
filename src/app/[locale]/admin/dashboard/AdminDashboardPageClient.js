'use client';

import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import AdminLayout from '@/components/admin/AdminLayout';
import MetricCard from '@/components/admin/MetricCard';
import SystemOverview from '@/components/admin/SystemOverview';
import ActivityOverview from '@/components/admin/ActivityOverview';
import useAdminStore from '@/store/adminStore';
import Toast from '@/components/shared/Toast';
import { AdminPageHeader, AdminLoading, AdminEmpty } from '@/components/admin/AdminUi';
import { BarChart3, Bolt, HardDrive, User } from '@/components/icons';

export default function AdminDashboardClient() {
  const {
    overviewMetrics,
    overviewLoading,
    activityMetrics,
    activityLoading,
    fetchOverviewMetrics,
    fetchActivityMetrics,
  } = useAdminStore(
    useShallow((s) => ({
      overviewMetrics: s.overviewMetrics,
      overviewLoading: s.overviewLoading,
      activityMetrics: s.activityMetrics,
      activityLoading: s.activityLoading,
      fetchOverviewMetrics: s.fetchOverviewMetrics,
      fetchActivityMetrics: s.fetchActivityMetrics,
    }))
  );
  const [toast, setToast] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchOverviewMetrics();
    fetchActivityMetrics();
  }, [fetchOverviewMetrics, fetchActivityMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchOverviewMetrics();
      fetchActivityMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchOverviewMetrics, fetchActivityMetrics]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Dashboard"
          description="Live overview of users, automation engines, and database footprint."
          actions={
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-white px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-alt dark:border-border-dark/60 dark:bg-surface-alt-dark dark:text-muted-dark dark:hover:bg-surface-alt-dark-hover">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="size-4 rounded border-border text-accent focus:ring-accent/30 dark:border-border-dark dark:text-accent-dark"
                aria-label="Auto-refresh every 30 seconds"
              />
              Auto-refresh (30s)
            </label>
          }
        />

        {overviewLoading && !overviewMetrics ? (
          <AdminLoading label="Loading metrics…" />
        ) : overviewMetrics ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Total users"
                value={overviewMetrics.users?.total || 0}
                subtitle={`${overviewMetrics.users?.active || 0} active`}
                icon={User}
              />
              <MetricCard
                title="Active rules"
                value={overviewMetrics.users?.with_active_rules || 0}
                subtitle="Users with automation"
                icon={Bolt}
              />
              <MetricCard
                title="Automation engines"
                value={overviewMetrics.automation_engines || 0}
                subtitle="Running engines"
                icon={BarChart3}
              />
              <MetricCard
                title="Total DB size"
                value={overviewMetrics.databases?.total_user_size_formatted || '0 MB'}
                subtitle={`${overviewMetrics.databases?.user_db_count || 0} databases`}
                icon={HardDrive}
              />
            </div>

            <SystemOverview metrics={overviewMetrics} />

            <ActivityOverview activity={activityMetrics} loading={activityLoading} />
          </>
        ) : (
          <AdminEmpty message="Failed to load metrics. Check backend connectivity and try again." />
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}

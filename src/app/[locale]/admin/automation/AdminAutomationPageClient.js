'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import adminApiClient from '@/utils/adminApiClient';
import AutomationOverview from '@/components/admin/AutomationOverview';
import { AdminPageHeader, AdminLoading } from '@/components/admin/AdminUi';

export default function AdminAutomationPageClient() {
  const [stats, setStats] = useState(null);
  const [rules, setRules] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const overview = await adminApiClient.getAutomationOverview({ limit: 50 });
        setStats(overview.stats);
        setRules(overview.rules || []);
        setExecutions(overview.executions || []);
        setErrors(overview.errors || []);
      } catch (error) {
        console.error('Error loading automation data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Automation"
          description="Rule counts, recent executions, and errors across all users."
        />

        {loading ? (
          <AdminLoading label="Loading automation data…" />
        ) : (
          <AutomationOverview stats={stats} rules={rules} executions={executions} errors={errors} />
        )}
      </div>
    </AdminLayout>
  );
}

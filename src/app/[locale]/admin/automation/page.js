'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import adminApiClient from '@/utils/adminApiClient';
import AutomationOverview from '@/components/admin/AutomationOverview';

export default function AdminAutomationPage() {
  const [stats, setStats] = useState(null);
  const [rules, setRules] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsResult, rulesResult, executionsResult, errorsResult] = await Promise.all([
          adminApiClient.getAutomationStats(),
          adminApiClient.getAutomationRules(),
          adminApiClient.getAutomationExecutions({ limit: 50 }),
          adminApiClient.getAutomationErrors({ limit: 50 }),
        ]);
        setStats(statsResult.stats);
        setRules(rulesResult.rules || []);
        setExecutions(executionsResult.executions || []);
        setErrors(errorsResult.errors || []);
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
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Automation Monitoring</h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading automation data...</p>
          </div>
        ) : (
          <AutomationOverview stats={stats} rules={rules} executions={executions} errors={errors} />
        )}
      </div>
    </AdminLayout>
  );
}

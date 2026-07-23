'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import adminApiClient from '@/utils/adminApiClient';
import { AdminAlert, AdminLoading, AdminPageHeader } from '@/components/admin/AdminUi';
import DiagnosticsSummaryCard from './DiagnosticsSummaryCard';
import DiagnosticsStatisticsSection from './DiagnosticsStatisticsSection';
import DiagnosticsActiveUsersSection from './DiagnosticsActiveUsersSection';
import DiagnosticsIssuesPanel from './DiagnosticsIssuesPanel';

export default function AdminDiagnosticsPageClient() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [repairLoading, setRepairLoading] = useState(false);

  const loadDiagnostics = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await adminApiClient.getDiagnostics();
      setDiagnostics(result);
    } catch (err) {
      console.error('Error loading diagnostics:', err);
      setError(err.message || 'Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const handleRepairStatusMismatches = async () => {
    try {
      setRepairLoading(true);
      setError(null);
      await adminApiClient.repairStatusMismatches();
      await loadDiagnostics();
    } catch (err) {
      console.error('Error repairing status mismatches:', err);
      setError(err.message || 'Repair failed');
    } finally {
      setRepairLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <AdminLoading label="Running diagnostics…" />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <AdminAlert variant="danger">Error: {error}</AdminAlert>
      </AdminLayout>
    );
  }

  if (!diagnostics) {
    return null;
  }

  const { statistics, issues, summary, activeUsersBreakdown, timestamp } = diagnostics;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Diagnostics"
          description="Database integrity checks, registry mismatches, and repair actions."
          meta={timestamp ? `Last run: ${new Date(timestamp).toLocaleString()}` : undefined}
          actions={
            <button type="button" onClick={loadDiagnostics} className="ui-btn-accent">
              Refresh
            </button>
          }
        />

        <DiagnosticsSummaryCard summary={summary} timestamp={timestamp} />
        <DiagnosticsStatisticsSection statistics={statistics} />
        <DiagnosticsActiveUsersSection activeUsersBreakdown={activeUsersBreakdown} />
        <DiagnosticsIssuesPanel
          issues={issues}
          statistics={statistics}
          summary={summary}
          repairLoading={repairLoading}
          onRepairStatusMismatches={handleRepairStatusMismatches}
        />
      </div>
    </AdminLayout>
  );
}

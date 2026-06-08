'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import adminApiClient from '@/utils/adminApiClient';
import { AdminAlert, AdminCard, AdminEmpty, AdminLoading, AdminPageHeader, AdminStatRow } from '@/components/admin/AdminUi';

export default function AdminSettingsPageClient() {
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
        <AdminPageHeader
          title="Settings"
          description="Read-only view of backend configuration. Changes require environment updates and a restart."
        />

        {loading ? (
          <AdminLoading label="Loading configuration…" />
        ) : config ? (
          <div className="space-y-4">
            <AdminCard title="Polling">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <AdminStatRow
                  label="Max concurrent polls"
                  value={config.polling?.max_concurrent_polls}
                />
                <AdminStatRow label="Poll timeout (ms)" value={config.polling?.poll_timeout_ms} />
                <AdminStatRow
                  label="Cleanup interval (hours)"
                  value={config.polling?.poller_cleanup_interval_hours}
                />
              </div>
            </AdminCard>

            <AdminCard title="Rate limiting">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <AdminStatRow
                  label="User rate limit"
                  value={config.rate_limiting?.user_rate_limit_max}
                />
                <AdminStatRow
                  label="Admin rate limit"
                  value={config.rate_limiting?.admin_rate_limit_max}
                />
              </div>
            </AdminCard>

            <AdminCard title="Upload retention (LIMITED tier defaults)">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <AdminStatRow
                  label="Max staged storage (MB)"
                  value={config.upload_quotas?.max_storage_mb}
                />
                <AdminStatRow
                  label="Max retained files"
                  value={config.upload_quotas?.max_files}
                />
              </div>
            </AdminCard>

            <AdminCard title="Database">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <AdminStatRow
                  label="Max connections"
                  value={config.database?.max_db_connections}
                />
                <div className="text-sm">
                  <span className="text-muted dark:text-muted-dark">Master DB path</span>
                  <p className="mt-1 break-all font-mono text-xs text-text dark:text-text-dark">
                    {config.database?.master_db_path}
                  </p>
                </div>
              </div>
            </AdminCard>

            <AdminAlert variant="warning">
              <strong>Note:</strong> Configuration updates require environment variable changes and
              a server restart.
            </AdminAlert>
          </div>
        ) : (
          <AdminEmpty message="Failed to load configuration." />
        )}
      </div>
    </AdminLayout>
  );
}

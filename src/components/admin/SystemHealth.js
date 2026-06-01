'use client';

import { useState } from 'react';
import adminApiClient from '@/utils/adminApiClient';
import { AdminAlert, AdminBadge, AdminCard, AdminStatRow } from './AdminUi';

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

  const pool = metrics.database?.connection_pool;
  const poolStatus = pool?.status || 'default';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <AdminCard title="Database health">
        {metrics.database?.master_database ? (
          <div className="space-y-3">
            <AdminStatRow
              label="Master DB size"
              value={metrics.database.master_database.size_formatted}
            />
            {pool ? (
              <>
                <AdminStatRow
                  label="Pool size (user DB connections)"
                  value={`${pool.size ?? pool.currentSize} / ${pool.maxSize}`}
                  hint="Open SQLite connections to per-user databases"
                />
                {pool.usagePercent != null ? (
                  <AdminStatRow label="Pool usage" value={`${pool.usagePercent}%`} />
                ) : null}
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted dark:text-muted-dark">Pool status</span>
                  <AdminBadge status={poolStatus}>{pool.status}</AdminBadge>
                </div>
                {!['healthy', 'warning'].includes(pool.status) ? (
                  <p className="text-xs text-muted dark:text-muted-dark">
                    Many user DBs have an open connection. Consider increasing{' '}
                    <code className="rounded bg-surface-alt px-1 dark:bg-surface-dark">
                      MAX_DB_CONNECTIONS
                    </code>{' '}
                    for large deployments.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted dark:text-muted-dark">No database metrics available.</p>
        )}
      </AdminCard>

      {metrics.polling ? (
        <AdminCard
          title="Polling scheduler"
          action={
            <AdminBadge status={metrics.polling.isRunning ? 'healthy' : 'critical'}>
              {metrics.polling.isRunning ? 'Running' : 'Stopped'}
            </AdminBadge>
          }
        >
          <div className="space-y-3">
            <AdminStatRow
              label="Active pollers"
              value={metrics.polling.activePollers || 0}
              hint="Users with at least one enabled automation rule"
            />
            <div className="border-t border-border/50 pt-4 dark:border-border-dark/50">
              <button
                type="button"
                onClick={handleSyncRulesFlags}
                disabled={syncing}
                className="ui-btn-accent disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync rules flags & refresh pollers'}
              </button>
              {syncMessage ? (
                <p
                  className={`mt-2 text-sm ${
                    syncMessage.type === 'success'
                      ? 'text-label-success-text dark:text-label-success-text-dark'
                      : 'text-label-danger-text dark:text-label-danger-text-dark'
                  }`}
                >
                  {syncMessage.text}
                </p>
              ) : null}
            </div>
          </div>
        </AdminCard>
      ) : null}
    </div>
  );
}

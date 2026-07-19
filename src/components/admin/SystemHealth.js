'use client';

import { useEffect, useState } from 'react';
import adminApiClient from '@/utils/adminApiClient';
import { AdminAlert, AdminBadge, AdminCard, AdminStatRow } from './AdminUi';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

export default function SystemHealth({ metrics, onRefresh }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [quotaSummary, setQuotaSummary] = useState(null);
  const [quotaEnforcing, setQuotaEnforcing] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState(null);
  const { confirm, ConfirmDialog } = useConfirmDialog({ cancelLabel: 'Cancel' });

  const loadQuotaSummary = async () => {
    try {
      const data = await adminApiClient.getUploadQuotaSummary();
      setQuotaSummary(data.summary);
    } catch {
      setQuotaSummary(null);
    }
  };

  useEffect(() => {
    loadQuotaSummary();
  }, []);

  const handleEnforceUploadQuotas = async () => {
    const over = quotaSummary?.over_quota_users ?? 0;
    const limits = quotaSummary?.limits;
    const storageLimit = quotaSummary?.limit_storage_formatted ?? '—';
    const fileLimit = limits?.maxFiles ?? '—';

    const confirmed = await confirm(
      `Enforce upload quotas for LIMITED users over limits?\n\n` +
        `This hard-deletes oldest completed/failed staged files (and their upload log rows) ` +
        `until each affected user is within ${storageLimit} and ${fileLimit} files.\n\n` +
        `Queued/processing uploads are never removed.\n` +
        `UNLIMITED users are skipped.\n\n` +
        `Users currently over quota: ${over}\n\n` +
        `Set tiers under Admin → Users before running this if heavy users should be exempt.`,
      { confirmLabel: 'Enforce', confirmVariant: 'danger', title: 'Enforce upload quotas' }
    );
    if (!confirmed) return;

    setQuotaEnforcing(true);
    setQuotaMessage(null);
    try {
      const data = await adminApiClient.enforceUploadQuotas();
      const r = data.result;
      setQuotaMessage({
        type: 'success',
        text:
          `Evicted ${r?.total_evicted ?? 0} upload(s) across ${r?.users_with_evictions ?? 0} user(s). ` +
          `${r?.still_over_quota ?? 0} user(s) still over quota (e.g. only active queue items left).`,
      });
      await loadQuotaSummary();
      onRefresh?.();
    } catch (err) {
      setQuotaMessage({ type: 'error', text: err.message || 'Enforcement failed' });
    } finally {
      setQuotaEnforcing(false);
    }
  };

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

      <AdminCard title="Upload retention">
        <div className="space-y-3">
          <p className="text-sm text-muted dark:text-muted-dark">
            Deploy only recounts staged upload usage — it does not delete files. Set user tiers
            under Users, then run enforcement when ready.
          </p>
          {quotaSummary ? (
            <>
              <AdminStatRow
                label="LIMITED users over quota"
                value={quotaSummary.over_quota_users ?? 0}
                hint={`Limits: ${quotaSummary.limit_storage_formatted ?? '—'} storage, ${quotaSummary.limits?.maxFiles ?? '—'} files`}
              />
              <AdminStatRow label="LIMITED users (total)" value={quotaSummary.limited_users ?? 0} />
            </>
          ) : (
            <p className="text-sm text-muted dark:text-muted-dark">Quota summary unavailable.</p>
          )}
          <div className="border-t border-border/50 pt-4 dark:border-border-dark/50">
            <button
              type="button"
              onClick={handleEnforceUploadQuotas}
              disabled={quotaEnforcing || !quotaSummary?.over_quota_users}
              className="ui-btn-accent disabled:opacity-50"
              title={
                quotaSummary?.over_quota_users
                  ? 'Evict oldest eligible staged files for over-quota LIMITED users'
                  : 'No LIMITED users are over quota'
              }
            >
              {quotaEnforcing ? 'Enforcing…' : 'Enforce upload quotas'}
            </button>
            {quotaMessage ? (
              <p
                className={`mt-2 text-sm ${
                  quotaMessage.type === 'success'
                    ? 'text-label-success-text dark:text-label-success-text-dark'
                    : 'text-label-danger-text dark:text-label-danger-text-dark'
                }`}
              >
                {quotaMessage.text}
              </p>
            ) : null}
          </div>
        </div>
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
      <ConfirmDialog />
    </div>
  );
}

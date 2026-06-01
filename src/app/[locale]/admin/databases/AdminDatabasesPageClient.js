'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import adminApiClient from '@/utils/adminApiClient';
import DatabaseList from '@/components/admin/DatabaseList';
import {
  AdminBadge,
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminStatRow,
} from '@/components/admin/AdminUi';

export default function AdminDatabasesPageClient() {
  const [databases, setDatabases] = useState([]);
  const [poolStats, setPoolStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dbsResult, poolResult] = await Promise.all([
          adminApiClient.getDatabases(),
          adminApiClient.getPoolStats(),
        ]);
        setDatabases(dbsResult.databases || []);
        setPoolStats(poolResult.pool);
      } catch (error) {
        console.error('Error loading databases:', error);
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
          title="Databases"
          description="Per-user SQLite databases, backups, and connection pool utilization."
        />

        {poolStats ? (
          <AdminCard
            title="Connection pool"
            action={<AdminBadge status={poolStats.status}>{poolStats.status}</AdminBadge>}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <AdminStatRow
                label="Current size"
                value={`${poolStats.size ?? poolStats.currentSize} / ${poolStats.maxSize}`}
              />
              <AdminStatRow label="Hits" value={poolStats.hits || 0} />
              <AdminStatRow label="Misses" value={poolStats.misses || 0} />
            </div>
          </AdminCard>
        ) : null}

        {loading ? (
          <AdminLoading label="Loading databases…" />
        ) : databases.length > 0 ? (
          <DatabaseList databases={databases} />
        ) : (
          <AdminEmpty message="No user databases found." />
        )}
      </div>
    </AdminLayout>
  );
}

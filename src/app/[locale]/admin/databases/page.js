'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import adminApiClient from '@/utils/adminApiClient';
import DatabaseList from '@/components/admin/DatabaseList';

export default function AdminDatabasesPage() {
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
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Database Management</h2>

        {poolStats && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connection Pool</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Size</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                  {poolStats.currentSize} / {poolStats.maxSize}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                <p
                  className={`mt-1 text-sm font-medium ${
                    poolStats.status === 'healthy'
                      ? 'text-green-600 dark:text-green-400'
                      : poolStats.status === 'warning'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {poolStats.status}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Hits</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white font-medium">{poolStats.hits || 0}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Misses</label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white font-medium">{poolStats.misses || 0}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading databases...</p>
          </div>
        ) : (
          <DatabaseList databases={databases} />
        )}
      </div>
    </AdminLayout>
  );
}

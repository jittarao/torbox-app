'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import LogViewer from '@/components/admin/LogViewer';

export default function AdminLogsPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Logs
        </h1>
        <LogViewer />
      </div>
    </AdminLayout>
  );
}

'use client';

import { useState } from 'react';
import adminApiClient from '@/utils/adminApiClient';
import {
  AdminBadge,
  AdminEmpty,
  adminCardClass,
  adminRowHoverClass,
  adminTableClass,
  adminTdClass,
  adminThClass,
  adminTheadClass,
} from './AdminUi';

export default function DatabaseList({ databases }) {
  const [backingUp, setBackingUp] = useState(null);
  const [vacuuming, setVacuuming] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const handleBackup = async (authId) => {
    setBackingUp(authId);
    try {
      const result = await adminApiClient.backupDatabase(authId);
      // Show success message with option to download
      if (
        confirm(
          `Backup created successfully!\n\nSize: ${result.backup.size_formatted}\n\nWould you like to download it now?`
        )
      ) {
        handleDownload(authId, result.backup.filename);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setBackingUp(null);
    }
  };

  const handleDownload = async (authId, filename) => {
    setDownloading(authId);
    try {
      let backupFilename = filename;

      // If no filename provided, get the latest backup
      if (!backupFilename) {
        const backupsResult = await adminApiClient.listBackups(authId);
        if (
          !backupsResult.success ||
          !backupsResult.backups ||
          backupsResult.backups.length === 0
        ) {
          alert('No backups found for this user. Create a backup first.');
          setDownloading(null);
          return;
        }
        // Use the most recent backup (first in sorted list)
        backupFilename = backupsResult.backups[0].filename;
      }

      // Get download URL
      const downloadUrl = await adminApiClient.downloadBackup(authId, backupFilename);
      const adminKey = adminApiClient.getAdminKey();

      // Fetch the file as a blob
      const response = await fetch(downloadUrl, {
        headers: adminKey ? { 'x-admin-key': adminKey } : undefined,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Error downloading backup: ${error.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleVacuum = async (authId) => {
    if (!confirm('Are you sure you want to run VACUUM on this database? This may take a while.')) {
      return;
    }
    setVacuuming(authId);
    try {
      const result = await adminApiClient.vacuumDatabase(authId);
      alert(`Vacuum completed. Space freed: ${result.space_freed_formatted}`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setVacuuming(null);
    }
  };

  if (databases.length === 0) {
    return <AdminEmpty message="No databases found." />;
  }

  const actionBtn =
    'text-sm font-medium text-accent hover:underline disabled:opacity-50 dark:text-accent-dark';

  return (
    <div className={`${adminCardClass} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className={adminTableClass}>
          <thead className={adminTheadClass}>
            <tr>
              <th className={adminThClass}>Auth ID</th>
              <th className={adminThClass}>Exists</th>
              <th className={adminThClass}>Size</th>
              <th className={`${adminThClass} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 dark:divide-border-dark/60">
            {databases.map((db) => (
              <tr
                key={db.auth_id}
                className={`bg-white dark:bg-surface-alt-dark ${adminRowHoverClass}`}
              >
                <td className={`${adminTdClass} font-mono text-xs`}>
                  {db.auth_id.substring(0, 16)}…
                </td>
                <td className={adminTdClass}>
                  <AdminBadge status={db.exists ? 'healthy' : 'critical'}>
                    {db.exists ? 'Yes' : 'No'}
                  </AdminBadge>
                </td>
                <td className={adminTdClass}>{db.size_formatted || 'N/A'}</td>
                <td className={`${adminTdClass} text-right`}>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleBackup(db.auth_id)}
                      disabled={!db.exists || backingUp === db.auth_id}
                      className={actionBtn}
                    >
                      {backingUp === db.auth_id ? 'Backing up…' : 'Backup'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(db.auth_id, null)}
                      disabled={!db.exists || downloading === db.auth_id}
                      className={actionBtn}
                      title="Download latest backup (if available)"
                    >
                      {downloading === db.auth_id ? 'Downloading…' : 'Download'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVacuum(db.auth_id)}
                      disabled={!db.exists || vacuuming === db.auth_id}
                      className={actionBtn}
                    >
                      {vacuuming === db.auth_id ? 'Vacuuming…' : 'Vacuum'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

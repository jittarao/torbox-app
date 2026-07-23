'use client';

import { User } from '@/components/icons';

export default function UserProfileHeader({ userData, statusInfo, StatusIcon, userIdLabel }) {
  return (
    <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-accent/10 dark:bg-accent-dark/10 flex items-center justify-center">
            <User className="size-8 text-accent dark:text-accent-dark" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-primary-text dark:text-primary-text-dark mb-1">
              {userData.email || 'User Profile'}
            </h2>
            <p className="text-sm text-muted dark:text-muted-dark">
              {userIdLabel}: {userData.id || 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {StatusIcon && <StatusIcon className="size-5" />}
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.status}
          </span>
        </div>
      </div>
    </div>
  );
}

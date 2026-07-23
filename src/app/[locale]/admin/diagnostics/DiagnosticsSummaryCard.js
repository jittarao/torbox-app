import { AdminBadge } from '@/components/admin/AdminUi';

export function getStatusColor(status) {
  switch (status) {
    case 'healthy':
      return 'text-green-600 dark:text-green-400';
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'critical':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted dark:text-muted-dark';
  }
}

export default function DiagnosticsSummaryCard({ summary, timestamp }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white shadow-sm dark:border-border-dark/60 dark:bg-surface-alt-dark p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
          Summary
        </h3>
        <AdminBadge status={summary.status}>{summary.status}</AdminBadge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-sm font-medium text-muted dark:text-muted-dark">Total Issues</span>
          <p
            className={`mt-1 text-2xl font-bold ${
              summary.totalIssues === 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {summary.totalIssues}
          </p>
        </div>
        <div>
          <span className="text-sm font-medium text-muted dark:text-muted-dark">Status</span>
          <p className={`mt-1 text-lg font-medium ${getStatusColor(summary.status)}`}>
            {summary.status}
          </p>
        </div>
        <div>
          <span className="text-sm font-medium text-muted dark:text-muted-dark">Last Checked</span>
          <p className="mt-1 text-sm text-primary-text dark:text-primary-text-dark">
            {new Date(timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

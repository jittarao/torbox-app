export default function DiagnosticsActiveUsersSection({ activeUsersBreakdown }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white shadow-sm dark:border-border-dark/60 dark:bg-surface-alt-dark p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark mb-4">
        Active Users Breakdown
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex justify-between">
          <span className="text-muted dark:text-muted-dark">Total Users:</span>
          <span className="font-medium text-primary-text dark:text-primary-text-dark">
            {activeUsersBreakdown.total}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted dark:text-muted-dark">Both Active:</span>
          <span className="font-medium text-green-600 dark:text-green-400">
            {activeUsersBreakdown.both_active}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted dark:text-muted-dark">Registry Active Only:</span>
          <span className="font-medium text-yellow-600 dark:text-yellow-400">
            {activeUsersBreakdown.registry_active_only}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted dark:text-muted-dark">API Key Active Only:</span>
          <span className="font-medium text-yellow-600 dark:text-yellow-400">
            {activeUsersBreakdown.api_key_active_only}
          </span>
        </div>
      </div>
    </div>
  );
}

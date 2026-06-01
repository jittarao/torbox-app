import MetricCard from './MetricCard';
import { AdminCard, adminTableClass, adminTheadClass, adminThClass, adminTdClass } from './AdminUi';
import { Bolt } from '@/components/icons';

export default function AutomationOverview({ stats, rules, executions, errors }) {
  return (
    <div className="space-y-6">
      {stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total rules" value={stats.rules?.total || 0} icon={Bolt} />
          <MetricCard title="Enabled rules" value={stats.rules?.enabled || 0} icon={Bolt} />
          <MetricCard
            title="Executions (7d)"
            value={stats.executions_last_7_days?.total || 0}
            icon={Bolt}
          />
          <MetricCard
            title="Success rate"
            value={stats.executions_last_7_days?.success_rate || '0%'}
            icon={Bolt}
          />
        </div>
      ) : null}

      {errors.length > 0 ? (
        <AdminCard title="Recent errors" bodyClassName="!p-0">
          <div className="overflow-x-auto">
            <table className={adminTableClass}>
              <thead className={adminTheadClass}>
                <tr>
                  <th className={adminThClass}>Rule</th>
                  <th className={adminThClass}>Error</th>
                  <th className={adminThClass}>Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 dark:divide-border-dark/60">
                {errors.slice(0, 10).map((error) => (
                  <tr key={error.id} className="bg-white dark:bg-surface-alt-dark">
                    <td className={`${adminTdClass} font-medium`}>{error.rule_name}</td>
                    <td className={`${adminTdClass} text-label-danger-text dark:text-label-danger-text-dark`}>
                      {error.error_message || 'Unknown error'}
                    </td>
                    <td className={`${adminTdClass} text-muted dark:text-muted-dark`}>
                      {new Date(error.executed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      ) : null}

      {(rules?.length > 0 || executions?.length > 0) && errors.length === 0 ? (
        <p className="text-center text-sm text-muted dark:text-muted-dark">
          No recent automation errors in the loaded window.
        </p>
      ) : null}
    </div>
  );
}

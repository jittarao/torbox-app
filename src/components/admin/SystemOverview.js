import { AdminCard, AdminStatRow, AdminBadge } from './AdminUi';

export default function SystemOverview({ metrics }) {
  if (!metrics) return null;

  const schedulerRunning = metrics.polling_scheduler?.isRunning;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <AdminCard title="Memory usage">
        <div className="space-y-3">
          <AdminStatRow label="RSS" value={metrics.memory?.rss} />
          <AdminStatRow label="Heap used" value={metrics.memory?.heapUsed} />
          <AdminStatRow label="Heap total" value={metrics.memory?.heapTotal} />
        </div>
      </AdminCard>

      <AdminCard title="System information">
        <div className="space-y-3">
          <AdminStatRow
            label="Uptime"
            value={metrics.system?.uptimeFormatted || metrics.system?.uptime}
          />
          <AdminStatRow label="Node version" value={metrics.system?.nodeVersion} />
          <AdminStatRow label="Platform" value={metrics.system?.platform} />
        </div>
      </AdminCard>

      {metrics.polling_scheduler ? (
        <AdminCard
          title="Polling scheduler"
          action={
            <AdminBadge status={schedulerRunning ? 'healthy' : 'critical'}>
              {schedulerRunning ? 'Running' : 'Stopped'}
            </AdminBadge>
          }
        >
          <div className="space-y-3">
            <AdminStatRow
              label="Active pollers"
              value={metrics.polling_scheduler.activePollers || 0}
            />
          </div>
        </AdminCard>
      ) : null}

      <AdminCard title="Database">
        <div className="space-y-3">
          <AdminStatRow
            label="Master DB"
            value={metrics.databases?.master_size_formatted || 'N/A'}
          />
          <AdminStatRow
            label="Total user DBs"
            value={metrics.databases?.total_user_size_formatted || '0 MB'}
          />
        </div>
      </AdminCard>
    </div>
  );
}

'use client';

import { adminCardClass } from './AdminUi';
import MetricCard from './MetricCard';
import { Activity, User } from '@/components/icons';

function DistributionBar({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted dark:text-muted-dark">{label}</span>
        <span className="font-medium text-text dark:text-text-dark">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-alt dark:bg-surface-alt-dark">
        <div
          className="h-full rounded-full bg-accent transition-all dark:bg-accent-dark"
          style={{ width: `${pct}%` }}
          role="presentation"
        />
      </div>
    </div>
  );
}

export default function ActivityOverview({ activity, loading }) {
  if (loading && !activity) {
    return null;
  }

  if (!activity) {
    return null;
  }

  const dist = activity.distribution || {};
  const distMax = Math.max(
    dist.today || 0,
    dist.yesterday || 0,
    dist.last7d || 0,
    dist.last30d || 0,
    dist.older || 0,
    dist.never || 0,
    1
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
          User activity
        </h2>
        <p className="mt-1 text-sm text-muted dark:text-muted-dark">
          Engagement from client beacons. Online status is in-memory (2 min window) and reflects
          this backend instance only when multiple instances run behind a load balancer.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Users online"
          value={activity.online ?? 0}
          subtitle="Active in last 2 minutes"
          icon={Activity}
        />
        <MetricCard
          title="Active (24h)"
          value={activity.last24h ?? 0}
          subtitle={`${activity.last7d ?? 0} in 7 days`}
          icon={User}
        />
        <MetricCard
          title="Active (30d)"
          value={activity.last30d ?? 0}
          subtitle={`${activity.last90d ?? 0} in 90 days`}
          icon={User}
        />
        <MetricCard
          title="Returning today"
          value={activity.returningToday ?? 0}
          subtitle="Back after 30+ days away"
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${adminCardClass} p-5 sm:p-6`}>
          <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
            Active users
          </h3>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted dark:text-muted-dark">Last 24h</dt>
              <dd className="mt-1 text-xl font-semibold">{activity.last24h ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted dark:text-muted-dark">Last 7 days</dt>
              <dd className="mt-1 text-xl font-semibold">{activity.last7d ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted dark:text-muted-dark">Last 30 days</dt>
              <dd className="mt-1 text-xl font-semibold">{activity.last30d ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted dark:text-muted-dark">All time</dt>
              <dd className="mt-1 text-xl font-semibold">{activity.allTime ?? 0}</dd>
            </div>
          </dl>
        </div>

        <div className={`${adminCardClass} p-5 sm:p-6`}>
          <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
            Inactive users
          </h3>
          <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted dark:text-muted-dark">&gt; 30 days</dt>
              <dd className="mt-1 text-xl font-semibold">{activity.inactive30d ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted dark:text-muted-dark">&gt; 90 days</dt>
              <dd className="mt-1 text-xl font-semibold">{activity.inactive90d ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted dark:text-muted-dark">&gt; 180 days</dt>
              <dd className="mt-1 text-xl font-semibold">{activity.inactive180d ?? 0}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${adminCardClass} p-5 sm:p-6`}>
          <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
            User growth
          </h3>
          <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted dark:text-muted-dark">Today</dt>
              <dd className="mt-1 text-xl font-semibold">{activity.newToday ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted dark:text-muted-dark">Last 7 days</dt>
              <dd className="mt-1 text-xl font-semibold">{activity.new7d ?? 0}</dd>
            </div>
            <div>
              <dt className="text-muted dark:text-muted-dark">Last 30 days</dt>
              <dd className="mt-1 text-xl font-semibold">{activity.new30d ?? 0}</dd>
            </div>
          </dl>
        </div>

        <div className={`${adminCardClass} p-5 sm:p-6`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-primary-text dark:text-primary-text-dark">
            <User className="size-4 opacity-70" aria-hidden />
            Activity distribution
          </h3>
          <div className="mt-4 space-y-3">
            <DistributionBar label="Today" value={dist.today ?? 0} max={distMax} />
            <DistributionBar label="Yesterday" value={dist.yesterday ?? 0} max={distMax} />
            <DistributionBar label="2–7 days ago" value={dist.last7d ?? 0} max={distMax} />
            <DistributionBar label="8–30 days ago" value={dist.last30d ?? 0} max={distMax} />
            <DistributionBar label="Older" value={dist.older ?? 0} max={distMax} />
            <DistributionBar label="Never active" value={dist.never ?? 0} max={distMax} />
          </div>
        </div>
      </div>
    </div>
  );
}

import { adminCardClass } from './AdminUi';

export default function MetricCard({ title, value, subtitle, icon: Icon, trend }) {
  return (
    <div
      className={`${adminCardClass} group relative overflow-hidden p-5 transition-shadow hover:shadow-md sm:p-6`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted dark:text-muted-dark">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-primary-text dark:text-primary-text-dark sm:text-3xl">
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted dark:text-muted-dark">{subtitle}</p>
          ) : null}
          {trend ? (
            <p className="mt-2 text-xs font-medium text-label-success-text dark:text-label-success-text-dark">
              {trend}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-accent dark:bg-amber-500/10 dark:text-accent-dark"
            aria-hidden
          >
            <Icon className="size-5 opacity-90" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

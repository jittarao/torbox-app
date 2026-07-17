'use client';

import type { ComponentType, ReactNode } from 'react';
import { desktopCardClass, desktopCardPadding } from '@/components/desktop/DesktopUi';

type DesktopSettingsSectionProps = {
  title?: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

export default function DesktopSettingsSection({
  title,
  description,
  icon: Icon,
  children,
  className = '',
  action,
}: DesktopSettingsSectionProps) {
  const hasHeader = Boolean(title || description || action);

  return (
    <section className={`${desktopCardClass} overflow-hidden ${className}`}>
      {hasHeader ? (
        <header className="flex items-start justify-between gap-4 border-b border-border/50 px-5 py-4 dark:border-border-dark/50 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-alt text-accent dark:border-border-dark/60 dark:bg-surface-dark dark:text-accent-dark">
                <Icon className="size-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h2 className="text-base font-semibold text-text dark:text-text-dark">{title}</h2>
              ) : null}
              {description ? (
                <p className="mt-1 text-sm leading-relaxed text-muted dark:text-muted-dark">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={desktopCardPadding}>{children}</div>
    </section>
  );
}

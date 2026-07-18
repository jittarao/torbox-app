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
  /** Tighter padding for dense setting groups */
  compact?: boolean;
};

export default function DesktopSettingsSection({
  title,
  description,
  icon: Icon,
  children,
  className = '',
  action,
  compact = false,
}: DesktopSettingsSectionProps) {
  const hasHeader = Boolean(title || description || action);
  const bodyPadding = compact ? 'p-4 sm:p-5' : desktopCardPadding;
  const headerAlign = description ? 'items-start' : 'items-center';

  return (
    <section className={`${desktopCardClass} overflow-hidden ${className}`}>
      {hasHeader ? (
        <header
          className={`flex ${headerAlign} justify-between gap-4 border-b border-border/50 px-5 py-3.5 dark:border-border-dark/50 sm:px-6`}
        >
          <div className={`flex min-w-0 gap-3 ${headerAlign}`}>
            {Icon ? (
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-alt text-accent dark:border-border-dark/60 dark:bg-surface-dark dark:text-accent-dark ${description ? 'mt-0.5' : ''}`}
              >
                <Icon className="size-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h3 className="text-sm font-semibold text-text dark:text-text-dark">{title}</h3>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted dark:text-muted-dark">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {action ? (
            <div className={`shrink-0 ${description ? 'pt-0.5' : ''}`}>{action}</div>
          ) : null}
        </header>
      ) : null}
      <div className={bodyPadding}>{children}</div>
    </section>
  );
}

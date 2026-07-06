'use client';

import { useRef } from 'react';

function ActiveCheckIcon({ className = 'size-3.5' }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function SidebarListItem({
  label,
  count,
  isActive,
  onClick,
  isMenuOpen = false,
  onMenuToggle,
  ariaLabel,
  title,
  leading = null,
  disabled = false,
}) {
  const menuButtonRef = useRef(null);

  return (
    <div
      className={`group relative flex items-center gap-1 rounded-md transition-colors ${
        isActive
          ? 'bg-accent/12 dark:bg-accent-dark/12 border border-accent/50 dark:border-accent-dark/50 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.06)]'
          : 'border border-transparent hover:bg-surface-alt dark:hover:bg-surface-alt-dark'
      }`}
    >
      <button
        type="button"
        onMouseDown={(e) => {
          if (e.shiftKey) e.preventDefault();
        }}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel || label}
        aria-pressed={isActive}
        title={title}
        className={`flex-1 min-w-0 flex items-center gap-2 py-1.5 pl-2 pr-1 text-left text-xs transition-colors ${
          disabled ? 'cursor-not-allowed opacity-50' : ''
        } ${
          isActive
            ? 'text-accent dark:text-accent-dark'
            : 'text-primary-text dark:text-primary-text-dark'
        }`}
      >
        <span
          className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
            isActive
              ? 'border-accent bg-accent text-white dark:border-accent-dark dark:bg-accent-dark'
              : 'border-border/80 bg-transparent dark:border-border-dark/80'
          }`}
          aria-hidden
        >
          {isActive && <ActiveCheckIcon className="size-2.5" />}
        </span>
        {leading}
        <span className="truncate font-medium">{label}</span>
        {count != null && count > 0 && (
          <span
            className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
              isActive
                ? 'bg-accent/15 text-accent dark:bg-accent-dark/20 dark:text-accent-dark'
                : 'bg-surface-alt dark:bg-surface-alt-dark text-primary-text/60 dark:text-primary-text-dark/60'
            }`}
          >
            {count}
          </span>
        )}
      </button>

      {onMenuToggle && (
        <div className="relative shrink-0 pr-0.5">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle(!isMenuOpen, menuButtonRef);
            }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 text-primary-text/60 hover:text-primary-text dark:text-primary-text-dark/60 dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-opacity"
            aria-label="Options"
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
          >
            <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import SidebarOverflowMenu from './SidebarOverflowMenu';

export default function SidebarListItem({
  label,
  count,
  isActive,
  onClick,
  menuItems = [],
  ariaLabel,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);

  return (
    <div
      className={`group relative flex items-center gap-1 rounded-md transition-colors ${
        isActive
          ? 'bg-accent/10 dark:bg-accent-dark/10 border border-accent/40 dark:border-accent-dark/40'
          : 'border border-transparent hover:bg-surface-alt dark:hover:bg-surface-alt-dark'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || label}
        aria-pressed={isActive}
        className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-left text-xs text-primary-text dark:text-primary-text-dark"
      >
        <span className="truncate font-medium">{label}</span>
        {count != null && count > 0 && (
          <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-surface-alt dark:bg-surface-alt-dark text-primary-text/60 dark:text-primary-text-dark/60">
            {count}
          </span>
        )}
      </button>

      {menuItems.length > 0 && (
        <div className="relative shrink-0 pr-0.5">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 text-primary-text/60 hover:text-primary-text dark:text-primary-text-dark/60 dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-opacity"
            aria-label="Options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
          <SidebarOverflowMenu
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={menuButtonRef}
            items={menuItems}
          />
        </div>
      )}
    </div>
  );
}

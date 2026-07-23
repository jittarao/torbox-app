'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import ModalOverlay from '@/components/shared/ModalOverlay';

export default function MoreOptionsMenuPanel({
  isMenuOpen,
  isMounted,
  mobileBar,
  menuRef,
  menuPosition,
  title,
  closeLabel,
  onClose,
  children,
}) {
  const portalMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!isMenuOpen || !isMounted) return null;

  if (mobileBar) {
    return (
      <ModalOverlay open={isMenuOpen} onClose={onClose} closeLabel={closeLabel}>
        <div
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="ui-bottom-sheet fixed bottom-0 left-0 right-0 z-[1] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border-0 border-t border-border/60 bg-surface shadow-2xl dark:border-border-dark/60 dark:bg-surface-dark"
        >
          <div className="flex shrink-0 justify-center pt-2.5 pb-1">
            <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5 dark:border-border-dark/40">
            <h2 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="ui-header-icon-btn shrink-0"
              aria-label={closeLabel}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="size-5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-1">
            {children}
          </div>
        </div>
      </ModalOverlay>
    );
  }

  if (!portalMounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-48 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
      }}
    >
      <div className="py-1">{children}</div>
    </div>,
    document.body
  );
}

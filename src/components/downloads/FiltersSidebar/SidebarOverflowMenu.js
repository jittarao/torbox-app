'use client';

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_MIN_WIDTH = 140;
const MENU_ITEM_HEIGHT = 30;
const MENU_PADDING = 8;

function stopMenuEvent(e) {
  e.preventDefault();
  e.stopPropagation();
}

export default function SidebarOverflowMenu({ isOpen, onClose, anchorRef, items }) {
  const menuRef = useRef(null);
  const [menuLayout, setMenuLayout] = useState(null);

  const updateMenuPosition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor || !isOpen) return;

    const rect = anchor.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const margin = 8;
    const gap = 4;
    const menuHeight = items.length * MENU_ITEM_HEIGHT + MENU_PADDING;
    const menuWidth = MENU_MIN_WIDTH;

    const spaceBelow = vh - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    let top;
    if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
      top = rect.bottom + gap;
    } else {
      top = Math.max(margin, rect.top - gap - menuHeight);
    }

    let left = rect.right - menuWidth;
    if (left < margin) left = margin;
    if (left + menuWidth > vw - margin) {
      left = vw - menuWidth - margin;
    }

    setMenuLayout({ top, left, width: menuWidth });
  }, [anchorRef, isOpen, items.length]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuLayout(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isOpen, updateMenuPosition]);

  const onCloseEvent = useEffectEvent(onClose);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onCloseEvent();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') onCloseEvent();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, anchorRef]);

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  if (!isOpen || !portalTarget || !menuLayout) return null;

  const handleItemActivate = (item) => {
    item.onClick();
    // Keep menu mounted until after the click finishes so the browser does not
    // retarget the click to whatever sits under the removed portal node.
    queueMicrotask(onClose);
  };

  return createPortal(
    <div
      ref={menuRef}
      className="z-overlay-popover fixed min-w-[140px] py-1 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md shadow-lg"
      style={{
        top: menuLayout.top,
        left: menuLayout.left,
        width: menuLayout.width,
      }}
      role="menu"
      tabIndex={-1}
      onClick={stopMenuEvent}
      onMouseDown={stopMenuEvent}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          onMouseDown={stopMenuEvent}
          onClick={(e) => {
            stopMenuEvent(e);
            handleItemActivate(item);
          }}
          disabled={item.disabled}
          className={`w-full px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-50 ${
            item.destructive
              ? 'text-red-500 hover:bg-red-500/10'
              : 'text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    portalTarget
  );
}

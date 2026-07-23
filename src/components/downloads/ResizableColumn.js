import { useState, useCallback, useEffect, useEffectEvent, useRef } from 'react';
import useIsMobile from '@/hooks/useIsMobile';
import { getColumnMinWidth } from './utils/tableColumnLayout';

export default function ResizableColumn({
  columnId,
  children,
  width = 60,
  onWidthChange,
  className = '',
  sortable = false,
  onClick,
}) {
  const [isResizing, setIsResizing] = useState(false);
  const isMobile = useIsMobile();
  const minWidth = getColumnMinWidth(columnId);
  const resizeRef = useRef({
    startX: 0,
    startWidth: 0,
  });
  const wasResizingRef = useRef(false);

  const handleMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      resizeRef.current = {
        startX: e.clientX,
        startWidth: parseInt(width || minWidth, 10),
      };
      setIsResizing(true);
    },
    [width, minWidth]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isResizing) return;

      e.preventDefault();
      e.stopPropagation();

      const { startX, startWidth } = resizeRef.current;
      const diff = e.clientX - startX;
      const newWidth = Math.max(startWidth + diff, minWidth);
      onWidthChange(newWidth);
    },
    [isResizing, onWidthChange, minWidth]
  );

  const handleMouseUp = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      wasResizingRef.current = isResizing;
      setIsResizing(false);
      setTimeout(() => {
        wasResizingRef.current = false;
      }, 0);
    },
    [isResizing]
  );

  const handleMouseMoveEvent = useEffectEvent((e) => handleMouseMove(e));
  const handleMouseUpEvent = useEffectEvent((e) => handleMouseUp(e));

  useEffect(() => {
    const onMouseMove = (e) => handleMouseMoveEvent(e);
    const onMouseUp = (e) => handleMouseUpEvent(e);

    if (isResizing) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  const pixelWidth = Math.max(minWidth, parseInt(width, 10) || minWidth);

  return (
    <th
      className={`relative group select-none overflow-hidden ${className} ${
        sortable ? 'cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark' : ''
      } ${isResizing ? 'bg-surface-hover/80 dark:bg-surface-hover-dark/80' : ''}`}
      style={
        pixelWidth == null
          ? undefined
          : {
              width: `${pixelWidth}px`,
              minWidth: `${pixelWidth}px`,
              maxWidth: `${pixelWidth}px`,
            }
      }
      onClick={(e) => {
        if (wasResizingRef.current) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
    >
      <div className="flex items-center min-w-0 pr-3">{children}</div>
      {!(isMobile && columnId === 'name') && (
        <button
          type="button"
          aria-label="Resize column"
          className="absolute right-0 top-0 bottom-0 z-20 w-3 cursor-col-resize touch-none flex items-center justify-center hover:bg-accent/15 dark:hover:bg-accent-dark/15"
          onMouseDown={handleMouseDown}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
            }
          }}
        >
          <hr
            aria-orientation="vertical"
            aria-label="Resize column"
            className="sr-only border-none"
          />
          <div
            className={`w-0.5 h-5 rounded-full transition-opacity ${
              isResizing
                ? 'opacity-100 bg-accent dark:bg-accent-dark'
                : 'opacity-0 group-hover:opacity-100 bg-accent/60 dark:bg-accent-dark/60'
            }`}
          />
        </button>
      )}
    </th>
  );
}

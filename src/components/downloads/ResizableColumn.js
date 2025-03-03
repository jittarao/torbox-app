import { useState, useCallback, useEffect, useRef } from 'react';
import useIsMobile from '@/hooks/useIsMobile';

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
  const [wasResizing, setWasResizing] = useState(false);
  const isMobile = useIsMobile();
  const resizeRef = useRef({
    startX: 0,
    startWidth: 0,
  });

  const handleMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      resizeRef.current = {
        startX: e.clientX,
        startWidth: parseInt(width || 60, 10),
      };
      setIsResizing(true);
    },
    [width],
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isResizing) return;

      e.preventDefault();
      e.stopPropagation();

      const { startX, startWidth } = resizeRef.current;
      const diff = e.clientX - startX;
      const newWidth = Math.max(startWidth + diff, 50);
      onWidthChange(newWidth);
    },
    [isResizing, onWidthChange],
  );

  const handleMouseUp = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setWasResizing(isResizing);
      setIsResizing(false);
    },
    [isResizing],
  );

  useEffect(() => {
    const onMouseMove = (e) => handleMouseMove(e);
    const onMouseUp = (e) => handleMouseUp(e);

    if (isResizing) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = 'none'; // Prevent text selection while resizing
    }

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = ''; // Reset user select
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (wasResizing) {
      const timer = setTimeout(() => setWasResizing(false), 0);
      return () => clearTimeout(timer);
    }
  }, [wasResizing]);

  return (
    <th
      className={`relative group select-none ${className} ${
        sortable
          ? 'cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark'
          : ''
      }`}
      style={
        isMobile && columnId === 'name'
          ? {}
          : {
              width: `${width}px`,
              minWidth: `${width}px`,
              maxWidth: `${width}px`,
            }
      }
      onClick={(e) => {
        if (wasResizing) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
    >
      <div className="flex items-center">{children}</div>
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group-hover:bg-accent/20 dark:group-hover:bg-accent-dark/20 flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[2px] h-4 opacity-0 group-hover:opacity-100 bg-accent/50 dark:bg-accent-dark/50 transition-opacity" />
      </div>
    </th>
  );
}

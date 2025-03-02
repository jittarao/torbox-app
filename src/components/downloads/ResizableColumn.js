import { useState, useCallback, useEffect, useRef } from 'react';
import useIsMobile from '@/hooks/useIsMobile';

export default function ResizableColumn({
  columnId,
  children,
  width,
  onWidthChange,
  className = '',
  sortable = false,
  onClick,
}) {
  const [isResizing, setIsResizing] = useState(false);
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
        startWidth: width,
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

      const diff = e.clientX - resizeRef.current.startX;
      const newWidth = Math.max(resizeRef.current.startWidth + diff, 50);
      onWidthChange(newWidth);
    },
    [isResizing, onWidthChange],
  );

  const handleMouseUp = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(false);
  }, []);

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

  return (
    <th
      className={`relative group select-none ${className} ${
        sortable
          ? 'cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark'
          : ''
      }`}
      style={
        columnId === 'name' && isMobile
          ? {}
          : {
              width: `${width}px`,
              minWidth: `${width}px`,
              maxWidth: `${width}px`,
            }
      }
      onClick={onClick}
    >
      <div className="flex items-center">{children}</div>
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-accent/20 dark:hover:bg-accent-dark/20"
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
}

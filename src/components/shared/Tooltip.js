import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ children, content, position = 'top' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  const updatePosition = () => {
    if (!triggerRef.current || !isVisible) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(triggerRef.current);
    const visibleWidth = parseFloat(computedStyle.width);

    let top, left;

    switch (position) {
      case 'top':
        top = rect.top - 4;
        left = rect.left + visibleWidth / 2;
        break;
      case 'bottom':
        top = rect.top + rect.height + 4;
        left = rect.left + visibleWidth / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - 4;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.left + visibleWidth + 4;
        break;
      default:
        top = rect.top - 4;
        left = rect.left + visibleWidth / 2;
    }

    setTooltipPosition({ top, left });
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible]);

  const tooltipStyles = {
    position: 'fixed',
    top: tooltipPosition.top,
    left: tooltipPosition.left,
    transform: 'translate(-50%, -100%)',
    zIndex: 9999,
    marginTop: -8, // Add some spacing
  };

  const arrowPosition = {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(45deg)',
    width: '8px',
    height: '8px',
    backgroundColor: 'inherit',
  };

  return (
    <div
      ref={triggerRef}
      className="inline-block max-w-full"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible &&
        createPortal(
          <div
            style={tooltipStyles}
            className="px-2 py-1 text-xs bg-gray-800 text-white rounded shadow-lg whitespace-nowrap"
            role="tooltip"
          >
            {content}
            <div style={arrowPosition} />
          </div>,
          document.body,
        )}
    </div>
  );
}

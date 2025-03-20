import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ children, content, position = 'top' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  const updatePosition = () => {
    if (!triggerRef.current || !isVisible) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top, left;

    switch (position) {
      case 'top':
        top = rect.top - 4;
        left = rect.left + rect.width / 2;
        break;
      case 'bottom':
        top = rect.top + rect.height + 4;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - 4;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.left + rect.width + 4;
        break;
      default:
        top = rect.top - 4;
        left = rect.left + rect.width / 2;
    }

    // Ensure tooltip stays within viewport bounds
    const tooltipWidth = 500; // Approximate max width
    const tooltipHeight = 40; // Approximate height
    const tooltipHalfWidth = tooltipWidth / 2;

    let translateXOffset = 0;
    let arrowOffset = '50%';

    if (left - tooltipHalfWidth < 0) {
      // If tooltip would go off left edge, pin it to left edge and adjust transform
      translateXOffset = -(tooltipHalfWidth - left);
      arrowOffset = `${(left / tooltipWidth) * 100}%`;
      left = tooltipHalfWidth;
    } else if (left + tooltipHalfWidth > viewportWidth) {
      // If tooltip would go off right edge, pin it to right edge and adjust transform
      translateXOffset = -(left + tooltipHalfWidth - viewportWidth);
      arrowOffset = `${((viewportWidth - left) / tooltipWidth) * 100}%`;
      left = viewportWidth - tooltipHalfWidth;
    }

    // Adjust vertical position if tooltip would go off screen
    if (top - tooltipHeight < 0) {
      top = rect.bottom + 4; // Switch to bottom position
    } else if (top + tooltipHeight > viewportHeight) {
      top = rect.top - tooltipHeight - 4; // Switch to top position
    }

    setTooltipPosition({ top, left, translateXOffset, arrowOffset });
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
    transform: `translate(calc(-50% + ${tooltipPosition.translateXOffset || 0}px), -100%)`,
    zIndex: 9999,
    marginTop: -8,
    maxWidth: '500px',
    wordWrap: 'break-word',
    whiteSpace: 'normal',
  };

  const arrowPosition = {
    position: 'absolute',
    top: '100%',
    left: tooltipPosition.arrowOffset || '50%',
    transform: 'translate(-50%, -50%) rotate(45deg)',
    width: '8px',
    height: '8px',
    backgroundColor: 'inherit',
  };

  if (!content) return children;

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

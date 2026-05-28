import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';

const activeTooltips = new Map();

function closeOtherTooltips(exceptId) {
  activeTooltips.forEach((close, id) => {
    if (id !== exceptId) close();
  });
}

function useCanHover() {
  const [canHover, setCanHover] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const onChange = (e) => setCanHover(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return canHover;
}

export default function Tooltip({ children, content, position = 'top' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipId = useId();
  const canHover = useCanHover();

  const hide = useCallback(() => setIsVisible(false), []);
  const show = useCallback(() => {
    closeOtherTooltips(tooltipId);
    setIsVisible(true);
  }, [tooltipId]);

  const updatePosition = useCallback(() => {
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

    const tooltipWidth = 500;
    const tooltipHeight = 40;
    const tooltipHalfWidth = tooltipWidth / 2;

    let translateXOffset = 0;
    let arrowOffset = '50%';

    if (left - tooltipHalfWidth < 0) {
      translateXOffset = -(tooltipHalfWidth - left);
      arrowOffset = `${(left / tooltipWidth) * 100}%`;
      left = tooltipHalfWidth;
    } else if (left + tooltipHalfWidth > viewportWidth) {
      translateXOffset = -(left + tooltipHalfWidth - viewportWidth);
      arrowOffset = `${((viewportWidth - left) / tooltipWidth) * 100}%`;
      left = viewportWidth - tooltipHalfWidth;
    }

    if (top - tooltipHeight < 0) {
      top = rect.bottom + 4;
    } else if (top + tooltipHeight > viewportHeight) {
      top = rect.top - tooltipHeight - 4;
    }

    setTooltipPosition({ top, left, translateXOffset, arrowOffset });
  }, [isVisible, position]);

  useEffect(() => {
    if (!isVisible) {
      activeTooltips.delete(tooltipId);
      return;
    }

    activeTooltips.set(tooltipId, hide);
    closeOtherTooltips(tooltipId);

    const onPointerDownOutside = (e) => {
      const trigger = triggerRef.current;
      if (!trigger || trigger.contains(e.target)) return;
      hide();
    };

    const onPointerMove = (e) => {
      if (!canHover) return;
      const trigger = triggerRef.current;
      if (!trigger) {
        hide();
        return;
      }
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      if (!hit || !trigger.contains(hit)) {
        hide();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') hide();
    };

    updatePosition();
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', updatePosition);
    document.addEventListener('pointerdown', onPointerDownOutside, true);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      activeTooltips.delete(tooltipId);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('pointerdown', onPointerDownOutside, true);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isVisible, updatePosition, hide, tooltipId, canHover]);

  useEffect(() => {
    if (!isVisible || canHover) return;
    const timer = setTimeout(hide, 2500);
    return () => clearTimeout(timer);
  }, [isVisible, canHover, hide]);

  const tooltipStyles = {
    position: 'fixed',
    top: tooltipPosition.top,
    left: tooltipPosition.left,
    transform: `translate(calc(-50% + ${tooltipPosition.translateXOffset || 0}px), -100%)`,
    zIndex: 9999,
    marginTop: -8,
    width: 'fit-content',
    maxWidth: 'min(500px, calc(100vw - 32px))',
    wordWrap: 'break-word',
    whiteSpace: 'normal',
    pointerEvents: 'none',
  };

  const arrowPosition = {
    left: tooltipPosition.arrowOffset || '50%',
    transform: 'translateX(-50%)',
  };

  if (!content) return children;

  return (
    <div
      ref={triggerRef}
      className="w-fit max-w-full"
      onMouseEnter={canHover ? show : undefined}
      onMouseLeave={canHover ? hide : undefined}
      onPointerDown={!canHover ? show : undefined}
    >
      {children}
      {isVisible &&
        createPortal(
          <div
            style={tooltipStyles}
            className="ui-tooltip"
            role="tooltip"
          >
            {content}
            <div className="ui-tooltip-arrow" style={arrowPosition} aria-hidden>
              <svg
                className="ui-tooltip-arrow-svg"
                viewBox="0 0 12 7"
                width="12"
                height="7"
              >
                <path className="ui-tooltip-arrow-fill" d="M1 1 L11 1 L6 6.5 Z" />
                <path className="ui-tooltip-arrow-stroke" d="M1 1 L6 6.5 L11 1" />
              </svg>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

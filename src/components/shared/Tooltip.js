import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useId,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

const activeTooltips = new Map();

function closeOtherTooltips(exceptId) {
  activeTooltips.forEach((close, id) => {
    if (id !== exceptId) close();
  });
}

function subscribeCanHover(callback) {
  const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
  const onChange = () => callback();
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getCanHoverSnapshot() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function getCanHoverServerSnapshot() {
  return true;
}

function useCanHover() {
  return useSyncExternalStore(subscribeCanHover, getCanHoverSnapshot, getCanHoverServerSnapshot);
}

export default function Tooltip({ children, content, position = 'top' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({
    top: 0,
    left: 0,
    arrowLeft: 0,
    placement: 'top',
  });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const positionRafRef = useRef(null);
  const tooltipId = useId();
  const canHover = useCanHover();

  const hide = useCallback(() => setIsVisible(false), []);
  const show = useCallback(() => {
    closeOtherTooltips(tooltipId);
    setIsVisible(true);
  }, [tooltipId]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !isVisible) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    const tooltipWidth = tooltipRect?.width ?? 0;
    const tooltipHeight = tooltipRect?.height ?? 0;

    if (tooltipWidth === 0 || tooltipHeight === 0) {
      if (tooltipRef.current) {
        positionRafRef.current = requestAnimationFrame(updatePosition);
      }
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const edgePadding = 16;
    const gap = 4;

    let anchorX;
    let placement = position === 'bottom' ? 'bottom' : 'top';

    if (position === 'left' || position === 'right') {
      placement = position;
    } else if (placement === 'top') {
      const spaceAbove = triggerRect.top - edgePadding;
      if (spaceAbove < tooltipHeight + gap) {
        placement = 'bottom';
      }
    } else {
      const spaceBelow = viewportHeight - triggerRect.bottom - edgePadding;
      if (spaceBelow < tooltipHeight + gap) {
        placement = 'top';
      }
    }

    let tooltipTop;
    switch (placement) {
      case 'bottom':
        anchorX = triggerRect.left + triggerRect.width / 2;
        tooltipTop = triggerRect.bottom + gap;
        break;
      case 'left':
        anchorX = triggerRect.left - gap;
        tooltipTop = triggerRect.top + triggerRect.height / 2;
        break;
      case 'right':
        anchorX = triggerRect.left + triggerRect.width + gap;
        tooltipTop = triggerRect.top + triggerRect.height / 2;
        break;
      case 'top':
      default:
        anchorX = triggerRect.left + triggerRect.width / 2;
        tooltipTop = triggerRect.top - gap;
    }

    let tooltipLeft = anchorX - tooltipWidth / 2;

    if (tooltipLeft < edgePadding) {
      tooltipLeft = edgePadding;
    } else if (tooltipLeft + tooltipWidth > viewportWidth - edgePadding) {
      tooltipLeft = viewportWidth - edgePadding - tooltipWidth;
    }

    if (placement === 'top' || placement === 'bottom') {
      if (placement === 'top' && tooltipTop - tooltipHeight < edgePadding) {
        placement = 'bottom';
        tooltipTop = triggerRect.bottom + gap;
      } else if (
        placement === 'bottom' &&
        tooltipTop + tooltipHeight > viewportHeight - edgePadding
      ) {
        placement = 'top';
        tooltipTop = triggerRect.top - gap;
      }
    }

    const arrowMargin = 12;
    const arrowLeft = Math.min(
      Math.max(anchorX - tooltipLeft, arrowMargin),
      tooltipWidth - arrowMargin
    );

    setTooltipPosition({
      top: tooltipTop,
      left: tooltipLeft,
      arrowLeft,
      placement,
    });
  }, [isVisible, position]);

  useLayoutEffect(() => {
    if (!isVisible) return;
    updatePosition();
  }, [isVisible, content, updatePosition]);

  useEffect(() => {
    if (!isVisible) {
      if (positionRafRef.current) {
        cancelAnimationFrame(positionRafRef.current);
        positionRafRef.current = null;
      }
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
      if (positionRafRef.current) {
        cancelAnimationFrame(positionRafRef.current);
        positionRafRef.current = null;
      }
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

  const isBelow = tooltipPosition.placement === 'bottom';

  const tooltipStyles = {
    position: 'fixed',
    top: tooltipPosition.top,
    left: tooltipPosition.left,
    transform: isBelow ? undefined : 'translateY(-100%)',
    zIndex: 9999,
    marginTop: isBelow ? 8 : -8,
    width: 'fit-content',
    maxWidth: 'min(500px, calc(100vw - 32px))',
    wordWrap: 'break-word',
    whiteSpace: 'normal',
    pointerEvents: 'none',
  };

  const arrowPosition = {
    left: tooltipPosition.arrowLeft,
    transform: 'translateX(-50%)',
    ...(isBelow ? { top: 'auto', bottom: '100%', marginTop: 0, marginBottom: -2 } : {}),
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
          <div ref={tooltipRef} style={tooltipStyles} className="ui-tooltip" role="tooltip">
            {content}
            <div className="ui-tooltip-arrow" style={arrowPosition} aria-hidden>
              <svg
                className="ui-tooltip-arrow-svg"
                viewBox="0 0 12 7"
                width="12"
                height="7"
                style={isBelow ? { transform: 'rotate(180deg)' } : undefined}
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

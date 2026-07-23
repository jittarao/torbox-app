import { useCallback, useEffect, useRef } from 'react';

const DOUBLE_TAP_MS = 300;
const SWIPE_THRESHOLD = 80;
const SEEK_ZONE_RATIO = 0.4;

/**
 * Mobile gesture handling: tap toggle chrome, double-tap seek, swipe down dismiss.
 * @param {Object} options
 * @param {boolean} options.enabled
 * @param {React.RefObject<HTMLElement | null>} options.targetRef
 * @param {() => void} options.onToggleControls
 * @param {(deltaSeconds: number, side: 'left' | 'right') => void} options.onDoubleTapSeek
 * @param {() => void} options.onSwipeDown
 * @param {() => boolean} [options.isBlocked]
 */
export function usePlayerGestures({
  enabled,
  targetRef,
  onToggleControls,
  onDoubleTapSeek,
  onSwipeDown,
  isBlocked = () => false,
}) {
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const pointerStartRef = useRef(null);
  const suppressTapRef = useRef(false);
  const toggleTimeoutRef = useRef(null);

  const clearToggleTimeout = useCallback(() => {
    if (toggleTimeoutRef.current) {
      clearTimeout(toggleTimeoutRef.current);
      toggleTimeoutRef.current = null;
    }
  }, []);

  const isInteractiveTarget = useCallback((target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        '[data-seekbar], [data-player-control], button, a, input, [role="dialog"], [data-player-sheet]'
      )
    );
  }, []);

  const handlePointerDown = useCallback(
    (e) => {
      if (!enabled || isBlocked()) return;
      if (isInteractiveTarget(e.target)) return;

      pointerStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        time: Date.now(),
      };
    },
    [enabled, isBlocked, isInteractiveTarget]
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (!enabled || isBlocked()) return;
      if (isInteractiveTarget(e.target)) return;

      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (!start || start.pointerId !== e.pointerId) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const elapsed = Date.now() - start.time;

      if (dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.5) {
        onSwipeDown();
        return;
      }

      if (elapsed > DOUBLE_TAP_MS * 2) return;

      const rect = targetRef.current?.getBoundingClientRect();
      if (!rect) return;

      const zoneWidth = rect.width * SEEK_ZONE_RATIO;
      const inLeft = e.clientX < rect.left + zoneWidth;
      const inRight = e.clientX > rect.right - zoneWidth;

      const last = lastTapRef.current;
      const isDoubleTap =
        Date.now() - last.time < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40;

      if (isDoubleTap && (inLeft || inRight)) {
        clearToggleTimeout();
        suppressTapRef.current = true;
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        onDoubleTapSeek(inLeft ? -10 : 10, inLeft ? 'left' : 'right');
        setTimeout(() => {
          suppressTapRef.current = false;
        }, DOUBLE_TAP_MS);
        return;
      }

      lastTapRef.current = { time: Date.now(), x: e.clientX, y: e.clientY };

      clearToggleTimeout();
      toggleTimeoutRef.current = setTimeout(() => {
        toggleTimeoutRef.current = null;
        if (suppressTapRef.current) return;
        if (Date.now() - lastTapRef.current.time >= DOUBLE_TAP_MS - 20) {
          onToggleControls();
        }
      }, DOUBLE_TAP_MS);
    },
    [
      enabled,
      isBlocked,
      isInteractiveTarget,
      targetRef,
      onSwipeDown,
      onDoubleTapSeek,
      onToggleControls,
      clearToggleTimeout,
    ]
  );

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !enabled) return undefined;

    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointerup', handlePointerUp);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointerup', handlePointerUp);
      clearToggleTimeout();
    };
  }, [targetRef, enabled, handlePointerDown, handlePointerUp, clearToggleTimeout]);
}

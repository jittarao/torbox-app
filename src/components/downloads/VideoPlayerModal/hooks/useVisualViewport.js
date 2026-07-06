import { useEffect } from 'react';

export const PLAYER_VV_VARS = {
  height: '--player-vv-height',
  offsetTop: '--player-vv-offset-top',
  offsetLeft: '--player-vv-offset-left',
  width: '--player-vv-width',
};

/**
 * @param {VisualViewport | null | undefined} vv
 * @param {number} [innerHeight]
 * @param {number} [innerWidth]
 * @returns {{ height: number, width: number, offsetTop: number, offsetLeft: number }}
 */
export function getVisualViewportMetrics(vv, innerHeight = 0, innerWidth = 0) {
  return {
    height: vv?.height ?? innerHeight,
    width: vv?.width ?? innerWidth,
    offsetTop: vv?.offsetTop ?? 0,
    offsetLeft: vv?.offsetLeft ?? 0,
  };
}

/**
 * @param {HTMLElement} element
 * @param {{ height: number, width: number, offsetTop: number, offsetLeft: number }} metrics
 */
export function applyVisualViewportMetrics(element, metrics) {
  element.style.setProperty(PLAYER_VV_VARS.height, `${metrics.height}px`);
  element.style.setProperty(PLAYER_VV_VARS.width, `${metrics.width}px`);
  element.style.setProperty(PLAYER_VV_VARS.offsetTop, `${metrics.offsetTop}px`);
  element.style.setProperty(PLAYER_VV_VARS.offsetLeft, `${metrics.offsetLeft}px`);
}

/** @param {HTMLElement} element */
export function clearVisualViewportMetrics(element) {
  for (const prop of Object.values(PLAYER_VV_VARS)) {
    element.style.removeProperty(prop);
  }
}

/**
 * Pin a fixed overlay to the visible viewport on mobile Safari (hides browser chrome overlap).
 * Falls back to 100dvh when Visual Viewport API is unavailable.
 *
 * @param {Object} options
 * @param {boolean} options.enabled
 * @param {React.RefObject<HTMLElement | null>} options.targetRef
 */
export function useVisualViewport({ enabled, targetRef }) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const element = targetRef.current;
    if (!element) return undefined;

    const vv = window.visualViewport;

    const update = () => {
      if (vv) {
        applyVisualViewportMetrics(
          element,
          getVisualViewportMetrics(vv, window.innerHeight, window.innerWidth)
        );
        return;
      }

      element.style.setProperty(PLAYER_VV_VARS.height, '100dvh');
      element.style.setProperty(PLAYER_VV_VARS.width, '100vw');
      element.style.setProperty(PLAYER_VV_VARS.offsetTop, '0px');
      element.style.setProperty(PLAYER_VV_VARS.offsetLeft, '0px');
    };

    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);

    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
      clearVisualViewportMetrics(element);
    };
  }, [enabled, targetRef]);
}

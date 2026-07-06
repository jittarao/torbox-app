import { describe, expect, test } from 'bun:test';
import {
  applyVisualViewportMetrics,
  clearVisualViewportMetrics,
  getVisualViewportMetrics,
  PLAYER_VV_VARS,
} from '../useVisualViewport';

describe('getVisualViewportMetrics', () => {
  test('uses visual viewport when available', () => {
    const metrics = getVisualViewportMetrics(
      { height: 650, width: 390, offsetTop: 44, offsetLeft: 0 },
      800,
      390
    );
    expect(metrics).toEqual({ height: 650, width: 390, offsetTop: 44, offsetLeft: 0 });
  });

  test('falls back to window dimensions', () => {
    const metrics = getVisualViewportMetrics(null, 800, 390);
    expect(metrics).toEqual({ height: 800, width: 390, offsetTop: 0, offsetLeft: 0 });
  });
});

describe('applyVisualViewportMetrics', () => {
  test('writes CSS custom properties on the target element', () => {
    const element = {
      style: {
        properties: {},
        setProperty(k, v) {
          this.properties[k] = v;
        },
        removeProperty(k) {
          delete this.properties[k];
        },
      },
    };
    applyVisualViewportMetrics(element, {
      height: 650,
      width: 390,
      offsetTop: 44,
      offsetLeft: 0,
    });
    expect(element.style.properties[PLAYER_VV_VARS.height]).toBe('650px');
    expect(element.style.properties[PLAYER_VV_VARS.width]).toBe('390px');
    expect(element.style.properties[PLAYER_VV_VARS.offsetTop]).toBe('44px');
    expect(element.style.properties[PLAYER_VV_VARS.offsetLeft]).toBe('0px');
    clearVisualViewportMetrics(element);
    expect(Object.keys(element.style.properties)).toHaveLength(0);
  });
});

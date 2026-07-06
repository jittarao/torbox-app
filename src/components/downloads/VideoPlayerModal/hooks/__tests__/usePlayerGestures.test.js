import { describe, expect, test } from 'bun:test';

const SEEK_ZONE_RATIO = 0.4;

function getSeekZone(clientX, rect) {
  const zoneWidth = rect.width * SEEK_ZONE_RATIO;
  const inLeft = clientX < rect.left + zoneWidth;
  const inRight = clientX > rect.right - zoneWidth;
  return { inLeft, inRight };
}

describe('double-tap seek zones', () => {
  const rect = { left: 0, width: 100, right: 100 };

  test('left 40% is left zone', () => {
    const { inLeft, inRight } = getSeekZone(30, rect);
    expect(inLeft).toBe(true);
    expect(inRight).toBe(false);
  });

  test('right 40% is right zone', () => {
    const { inLeft, inRight } = getSeekZone(80, rect);
    expect(inLeft).toBe(false);
    expect(inRight).toBe(true);
  });

  test('center 20% is neither zone', () => {
    const { inLeft, inRight } = getSeekZone(50, rect);
    expect(inLeft).toBe(false);
    expect(inRight).toBe(false);
  });
});

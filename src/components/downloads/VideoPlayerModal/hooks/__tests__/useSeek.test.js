import { describe, expect, test } from 'bun:test';

function getTimeFromClientX(clientX, rect, duration) {
  const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return pos * duration;
}

describe('seek math', () => {
  const rect = { left: 100, width: 200 };

  test('maps click at start to 0', () => {
    expect(getTimeFromClientX(100, rect, 120)).toBe(0);
  });

  test('maps click at end to duration', () => {
    expect(getTimeFromClientX(300, rect, 120)).toBe(120);
  });

  test('maps click at midpoint to half duration', () => {
    expect(getTimeFromClientX(200, rect, 100)).toBe(50);
  });

  test('clamps outside bounds', () => {
    expect(getTimeFromClientX(50, rect, 100)).toBe(0);
    expect(getTimeFromClientX(400, rect, 100)).toBe(100);
  });
});

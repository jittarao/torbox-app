export function computeOverlayDropdownLayout(rect, { widthKey = 'minWidth' } = {}) {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const margin = 8;
  const gap = 4;
  const preferredMax = Math.min(560, Math.round(vh * 0.72));
  const minUsable = 140;

  const spaceBelow = vh - rect.bottom - margin;
  const spaceAbove = rect.top - margin;

  let top;
  let maxHeight;

  if (spaceBelow >= minUsable || spaceBelow >= spaceAbove) {
    top = rect.bottom + gap;
    maxHeight = Math.min(preferredMax, spaceBelow);
  } else {
    maxHeight = Math.min(preferredMax, spaceAbove - gap);
    top = rect.top - gap - maxHeight;
  }

  maxHeight = Math.max(maxHeight, minUsable);

  let left = rect.left;
  const width = rect.width;
  if (left + width > vw - margin) {
    left = Math.max(margin, vw - width - margin);
  }
  if (left < margin) left = margin;

  if (widthKey === 'width') {
    return { top, left, width, maxHeight };
  }

  return { top, left, minWidth: width, maxHeight };
}

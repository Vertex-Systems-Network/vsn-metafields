// Fixed body overlay escapes Shopify section/box shadow-root clipping.
export function selectPosition(rect, width, height, topInset = 8, viewport = {}) {
  const gap = 6,
    edge = 8;
  const leftEdge = (viewport.offsetLeft || 0) + edge;
  const rightEdge = leftEdge + width - edge * 2;
  const visibleTop = Math.max(topInset, (viewport.offsetTop || 0) + edge);
  const visibleBottom = (viewport.offsetTop || 0) + height;
  const below = Math.max(0, visibleBottom - rect.bottom - gap - edge);
  const above = Math.max(0, rect.top - gap - visibleTop);
  const upward = below < 240 && above > below;
  const available = upward ? above : below;
  const popupWidth = Math.min(460, Math.max(rect.width, 220), width - edge * 2);
  return {
    left: Math.max(leftEdge, Math.min(rect.left, rightEdge - popupWidth)),
    width: popupWidth,
    maxHeight: Math.min(420, available),
    ...(upward
      ? { bottom: (viewport.layoutHeight || height) - rect.top + gap }
      : { top: rect.bottom + gap }),
  };
}

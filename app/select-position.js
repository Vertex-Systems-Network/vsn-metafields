// Fixed body overlay escapes Shopify section/box shadow-root clipping.
export function selectPosition(rect, width, height, topInset = 80) {
  const gap = 6,
    edge = 8;
  const below = Math.max(0, height - rect.bottom - gap - edge);
  const above = Math.max(0, rect.top - gap - topInset);
  const upward = below < 240 && above > below;
  const available = upward ? above : below;
  const popupWidth = Math.min(460, Math.max(rect.width, 220), width - edge * 2);
  return {
    left: Math.max(edge, Math.min(rect.left, width - popupWidth - edge)),
    width: popupWidth,
    maxHeight: Math.min(420, available),
    ...(upward
      ? { bottom: height - rect.top + gap }
      : { top: rect.bottom + gap }),
  };
}

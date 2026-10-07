export const PLAN_CONTENT_GUTTER = 104;

export function getPlanContentLayout({ contentLeft, contentWidth, bodyLeft }) {
  return {
    inlineSize: Math.max(0, contentWidth - PLAN_CONTENT_GUTTER * 2),
    translateX: contentLeft + PLAN_CONTENT_GUTTER - bodyLeft,
  };
}

export const WORKSPACE_CONTENT_GUTTER = 52;

export function getWorkspaceContentLayout({ contentLeft, contentWidth, bodyLeft }) {
  return {
    inlineSize: Math.max(0, contentWidth - WORKSPACE_CONTENT_GUTTER * 2),
    translateX: contentLeft + WORKSPACE_CONTENT_GUTTER - bodyLeft,
  };
}

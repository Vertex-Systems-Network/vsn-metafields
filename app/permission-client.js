export const REFERENCE_PERMISSIONS = Object.freeze({
  pageReferences: Object.freeze({
    label: "Pages & articles",
    scope: "read_content",
    purpose: "Find pages and articles to link in reference values.",
    action: "Enable page references",
  }),
  fileReferences: Object.freeze({
    label: "Files & media",
    scope: "read_files",
    purpose: "Find existing images, videos and files in your store.",
    action: "Enable file references",
  }),
});

export async function requestReferencePermission(shopify, feature) {
  const permission = REFERENCE_PERMISSIONS[feature];
  if (!permission) throw new Error("Choose a supported reference permission.");
  if (!shopify?.scopes?.query || !shopify?.scopes?.request)
    throw new Error("Open this app inside Shopify Admin to enable references.");
  const detail = await shopify.scopes.query();
  if (detail.granted?.includes(permission.scope)) return "already-granted";
  if (!detail.optional?.includes(permission.scope))
    throw new Error(
      "The permission update is not available on this app version yet. Ask the store owner to update or reopen the app, then try again.",
    );
  const response = await shopify.scopes.request([permission.scope]);
  if (response.result === "declined-all") return "declined";
  if (response.result !== "granted-all")
    throw new Error(
      "Shopify did not confirm permission. Refresh the connection status before retrying.",
    );
  return "granted";
}

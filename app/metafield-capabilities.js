// Shopify Admin GraphQL 2026-07 owner inventory. Availability is probed per shop.
export const METAFIELD_API_VERSION = "2026-07";
export const OWNER_TYPES = [
  "API_PERMISSION",
  "ARTICLE",
  "BLOG",
  "CARTTRANSFORM",
  "COLLECTION",
  "COMPANY",
  "COMPANY_LOCATION",
  "CUSTOMER",
  "DELIVERY_CUSTOMIZATION",
  "DISCOUNT",
  "DRAFTORDER",
  "FULFILLMENT_CONSTRAINT_RULE",
  "GIFT_CARD_TRANSACTION",
  "LOCATION",
  "MARKET",
  "ORDER",
  "ORDER_ROUTING_LOCATION_RULE",
  "PAGE",
  "PAYMENT_CUSTOMIZATION",
  "PRODUCT",
  "PRODUCTVARIANT",
  "SELLING_PLAN",
  "SHOP",
  "TRANSFER",
  "VALIDATION",
  "MEDIA_IMAGE",
];
export const PUBLIC_OWNERS = new Set([
  "PRODUCT",
  "PRODUCTVARIANT",
  "COLLECTION",
  "ARTICLE",
  "BLOG",
  "PAGE",
  "SHOP",
]);
export const VALUE_OWNERS = new Set([
  "PRODUCT",
  "PRODUCTVARIANT",
  "COLLECTION",
]);
export function requireOwnerType(value) {
  const owner = String(value || "PRODUCT").toUpperCase();
  if (!OWNER_TYPES.includes(owner) || owner === "MEDIA_IMAGE")
    throw new RangeError("Unsupported or deprecated metafield owner type.");
  return owner;
}
export function validateNamespace(value) {
  const namespace = String(value || "vsn_metafields").trim();
  if (
    !/^[a-zA-Z0-9_-]{3,255}$/.test(namespace) ||
    namespace.startsWith("app--") ||
    namespace === "shopify" ||
    namespace.startsWith("shopify--")
  ) {
    throw new RangeError(
      "Use a custom namespace of 3–255 letters, numbers, underscores or hyphens. Reserved namespaces use Shopify templates.",
    );
  }
  return namespace;
}
export function storefrontAccess(ownerType, value) {
  if (!["NONE", "PUBLIC_READ"].includes(value))
    throw new RangeError("Invalid storefront access.");
  if (value === "PUBLIC_READ" && !PUBLIC_OWNERS.has(ownerType))
    throw new RangeError(
      "Public blocks are unavailable for this resource; keep storefront access private.",
    );
  return value;
}

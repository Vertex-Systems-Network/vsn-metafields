const OWNER_GIDS = {
  PRODUCT: "Product",
  PRODUCTVARIANT: "ProductVariant",
  COLLECTION: "Collection",
};
const SUPPORTED_TYPES = new Set([
  "single_line_text_field", "multi_line_text_field", "number_integer",
  "date", "boolean", "url",
]);

export function validateValueInput(ownerType, ownerId, definition, rawValue) {
  if (!OWNER_GIDS[ownerType] || !new RegExp(`^gid://shopify/${OWNER_GIDS[ownerType]}/[0-9]+$`).test(ownerId)) {
    throw new RangeError("Resource does not match the selected owner type.");
  }
  if (!definition || definition.namespace !== "vsn_metafields" || !SUPPORTED_TYPES.has(definition.type)) {
    throw new RangeError("Supported custom definition not found for this resource.");
  }
  const value = String(rawValue ?? "");
  if (!value || value.length > 64000) throw new RangeError("Enter a value under 64,000 characters.");
  if (definition.type === "number_integer" && !/^-?(0|[1-9][0-9]*)$/.test(value)) {
    throw new RangeError("Enter a whole number.");
  }
  if (definition.type === "boolean" && value !== "true" && value !== "false") {
    throw new RangeError("Choose true or false.");
  }
  if (definition.type === "date") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const date = match && new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (!match || !date || date.toISOString().slice(0, 10) !== value) {
      throw new RangeError("Enter a valid date as YYYY-MM-DD.");
    }
  }
  if (definition.type === "url") {
    let parsed;
    try { parsed = new URL(value); } catch { throw new RangeError("Enter a valid HTTPS URL."); }
    if (parsed.protocol !== "https:") throw new RangeError("Enter a valid HTTPS URL.");
  }
  return value;
}

export async function mutateValue(admin, { action, ownerId, definition, value }) {
  const identity = { ownerId, namespace: definition.namespace, key: definition.key };
  if (action === "set") {
    const response = await admin.graphql(`#graphql
      mutation SetVsnValue($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id value }
          userErrors { field message }
        }
      }
    `, { variables: { metafields: [{ ...identity, type: definition.type, value }] } });
    const result = await response.json();
    const payload = result?.data?.metafieldsSet;
    const error = result?.errors?.[0]?.message || payload?.userErrors?.[0]?.message;
    if (error || !payload?.metafields?.[0]?.id) {
      return { ok: false, error: error || "Shopify did not confirm the value." };
    }
    return { ok: true };
  }
  if (action === "delete") {
    const response = await admin.graphql(`#graphql
      mutation DeleteVsnValue($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields { ownerId namespace key }
          userErrors { field message }
        }
      }
    `, { variables: { metafields: [identity] } });
    const result = await response.json();
    const payload = result?.data?.metafieldsDelete;
    const error = result?.errors?.[0]?.message || payload?.userErrors?.[0]?.message;
    const deleted = payload?.deletedMetafields?.[0];
    if (error || deleted?.ownerId !== ownerId || deleted?.namespace !== identity.namespace || deleted?.key !== identity.key) {
      return { ok: false, error: error || "Shopify did not confirm the deletion." };
    }
    return { ok: true };
  }
  throw new RangeError("Unsupported value action.");
}

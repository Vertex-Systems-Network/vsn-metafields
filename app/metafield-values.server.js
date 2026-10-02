import { encodeValue, REFERENCE_TYPES } from "./value-types.js";
import { graph, getDefinitions } from "./definitions.server.js";
export const OWNER_GIDS = {
  PRODUCT: "Product",
  PRODUCTVARIANT: "ProductVariant",
  COLLECTION: "Collection",
};

export function validateValueInput(ownerType, ownerId, definition, rawValue) {
  if (
    !OWNER_GIDS[ownerType] ||
    !new RegExp(`^gid://shopify/${OWNER_GIDS[ownerType]}/[0-9]+$`).test(ownerId)
  ) {
    throw new RangeError("Resource does not match the selected owner type.");
  }
  if (
    !definition ||
    !/^[a-zA-Z0-9_-]{3,255}$/.test(definition.namespace) ||
    definition.namespace.startsWith("app--") ||
    !/^[a-zA-Z0-9_-]{2,64}$/.test(definition.key)
  ) {
    throw new RangeError("Supported definition not found for this resource.");
  }
  if (
    definition.namespace === "shopify" ||
    definition.namespace.startsWith("shopify--")
  )
    throw new RangeError("Shopify-owned values require the native editor.");
  return encodeValue(definition.type, rawValue, definition.validations);
}

export async function findValueDefinition(admin, ownerType, namespace, key) {
  if (!OWNER_GIDS[ownerType])
    throw new RangeError("Unsupported resource owner.");
  const field = (await getDefinitions(admin, ownerType)).find(
    (item) => item.namespace === namespace && item.key === key,
  );
  if (!field) throw new RangeError("Definition not found for this resource.");
  return field;
}
export async function readResourceValue(
  admin,
  ownerType,
  ownerId,
  namespace,
  key,
) {
  if (
    !OWNER_GIDS[ownerType] ||
    !new RegExp(`^gid://shopify/${OWNER_GIDS[ownerType]}/[0-9]+$`).test(ownerId)
  )
    throw new RangeError("Resource does not match the selected owner type.");
  const data = await graph(
    admin,
    `#graphql
    query TypedResourceValue($id: ID!, $namespace: String!, $key: String!) {
      node(id: $id) { __typename
        ... on Product { id metafield(namespace:$namespace,key:$key) { id value type compareDigest } }
        ... on ProductVariant { id metafield(namespace:$namespace,key:$key) { id value type compareDigest } }
        ... on Collection { id metafield(namespace:$namespace,key:$key) { id value type compareDigest } }
      }
    }`,
    { id: ownerId, namespace, key },
  );
  if (
    data.node?.id !== ownerId ||
    data.node.__typename !== OWNER_GIDS[ownerType]
  )
    throw new RangeError("Resource was not found for this owner.");
  return data.node.metafield;
}
export async function verifyReferences(admin, type, value) {
  const base = type.replace(/^list\./, "");
  if (!REFERENCE_TYPES[base]) return;
  const ids = type.startsWith("list.") ? JSON.parse(value) : [value];
  const data = await graph(
    admin,
    `#graphql
    query VerifyTypedReferences($ids: [ID!]!) { nodes(ids:$ids) { id __typename } }`,
    { ids },
  );
  if (
    !Array.isArray(data.nodes) ||
    data.nodes.length !== ids.length ||
    data.nodes.some(
      (node, i) =>
        node?.id !== ids[i] || !REFERENCE_TYPES[base].includes(node.__typename),
    )
  )
    throw new RangeError(
      "A reference is missing, inaccessible or has the wrong type.",
    );
}

export async function mutateValue(
  admin,
  { action, ownerId, definition, value, compareDigest },
) {
  const identity = {
    ownerId,
    namespace: definition.namespace,
    key: definition.key,
  };
  if (action === "set") {
    const response = await admin.graphql(
      `#graphql
      mutation SetVsnValue($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id owner { ... on Product { id } ... on ProductVariant { id } ... on Collection { id } } namespace key type value compareDigest }
          userErrors { field message code }
        }
      }
    `,
      {
        variables: {
          metafields: [
            {
              ...identity,
              type: definition.type,
              value,
              ...(compareDigest !== undefined ? { compareDigest } : {}),
            },
          ],
        },
      },
    );
    const result = await response.json();
    const payload = result?.data?.metafieldsSet;
    const error =
      result?.errors?.[0]?.message || payload?.userErrors?.[0]?.message;
    const saved = payload?.metafields?.[0];
    if (
      error ||
      !saved?.id ||
      saved.namespace !== identity.namespace ||
      saved.key !== identity.key ||
      saved.owner?.id !== ownerId ||
      saved.type !== definition.type
    ) {
      return {
        ok: false,
        error: error || "Shopify did not confirm the value identity.",
        code: payload?.userErrors?.[0]?.code || "unconfirmed_value",
      };
    }
    return { ok: true, metafield: saved };
  }
  if (action === "delete") {
    const response = await admin.graphql(
      `#graphql
      mutation DeleteVsnValue($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields { ownerId namespace key }
          userErrors { field message }
        }
      }
    `,
      { variables: { metafields: [identity] } },
    );
    const result = await response.json();
    const payload = result?.data?.metafieldsDelete;
    const error =
      result?.errors?.[0]?.message || payload?.userErrors?.[0]?.message;
    const deleted = payload?.deletedMetafields?.[0];
    if (
      error ||
      deleted?.ownerId !== ownerId ||
      deleted?.namespace !== identity.namespace ||
      deleted?.key !== identity.key
    ) {
      return {
        ok: false,
        error: error || "Shopify did not confirm the deletion.",
      };
    }
    return { ok: true };
  }
  throw new RangeError("Unsupported value action.");
}

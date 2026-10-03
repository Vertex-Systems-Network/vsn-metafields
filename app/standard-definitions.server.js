const TEMPLATE_PREFIX = "gid://shopify/StandardMetafieldDefinitionTemplate/";
import {
  requireOwnerType,
  storefrontAccess,
} from "./metafield-capabilities.js";

export async function getStandardTemplates(admin, ownerType) {
  ownerType = requireOwnerType(ownerType);
  const templates = [];
  let after = null;
  let hasNextPage = true;
  for (let page = 0; hasNextPage; page++) {
    if (page >= 100)
      throw new Error(
        "Standard definition pagination exceeded the safe limit.",
      );
    const batch = await getStandardTemplatePage(admin, ownerType, after);
    templates.push(
      ...batch.templates.map((item) => {
        const template = { ...item };
        delete template.catalogCursor;
        return template;
      }),
    );
    hasNextPage = batch.pageInfo.hasNextPage;
    after = batch.pageInfo.endCursor;
  }
  return templates;
}

// Interactive requests fetch one page only. Full enumeration above is for the
// offline acceptance probe, never a Worker route or template-enable action.
export async function getStandardTemplatePage(admin, ownerType, cursor = null) {
  ownerType = requireOwnerType(ownerType);
  const after = cursor || null;
  if (after !== null && (typeof after !== "string" || after.length > 2048))
    throw new RangeError("Invalid standard template page cursor.");
  const response = await admin.graphql(
    `#graphql
      query StandardMetafieldCatalog($after: String) {
        standardMetafieldDefinitionTemplates(first: 250, after: $after) {
          nodes { id name namespace key description ownerTypes type { name } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `,
    { variables: { after } },
  );
  const result = await response.json();
  const connection = result?.data?.standardMetafieldDefinitionTemplates;
  if (
    result?.errors?.length ||
    !Array.isArray(connection?.nodes) ||
    !connection?.pageInfo
  ) {
    throw new Error(
      result?.errors?.[0]?.message || "Could not load standard definitions.",
    );
  }
  const hasNextPage = Boolean(connection.pageInfo.hasNextPage);
  if (
    hasNextPage &&
    (!connection.pageInfo.endCursor || connection.pageInfo.endCursor === after)
  ) {
    throw new Error("Standard definition pagination did not advance.");
  }
  return {
    templates: connection.nodes
      .filter((template) => template.ownerTypes?.includes(ownerType))
      .map((template) => ({ ...template, catalogCursor: after || "" })),
    pageInfo: { hasNextPage, endCursor: connection.pageInfo.endCursor || null },
    cursor: after || "",
  };
}

export async function enableStandardTemplate(
  admin,
  templates,
  ownerType,
  id,
  storefront = "NONE",
) {
  ownerType = requireOwnerType(ownerType);
  storefront = storefrontAccess(ownerType, storefront);
  const selected = templates.find(
    (item) => item.id === id && item.ownerTypes?.includes(ownerType),
  );
  if (typeof id !== "string" || !id.startsWith(TEMPLATE_PREFIX) || !selected) {
    return {
      ok: false,
      status: 400,
      error: "Standard definition is unavailable for this resource.",
    };
  }
  const response = await admin.graphql(
    `#graphql
    mutation EnableStandardMetafield($id: ID!, $ownerType: MetafieldOwnerType!, $storefront: MetafieldStorefrontAccessInput!) {
      standardMetafieldDefinitionEnable(id: $id, ownerType: $ownerType, pin: true, access: { storefront: $storefront }) {
        createdDefinition { id name namespace key ownerType }
        userErrors { field message }
      }
    }
  `,
    { variables: { id, ownerType, storefront } },
  );
  const result = await response.json();
  const payload = result?.data?.standardMetafieldDefinitionEnable;
  const error =
    result?.errors?.[0]?.message || payload?.userErrors?.[0]?.message;
  const created = payload?.createdDefinition;
  if (
    error ||
    !created?.id ||
    created.namespace !== selected.namespace ||
    created.key !== selected.key ||
    created.ownerType !== ownerType
  ) {
    return {
      ok: false,
      status: 400,
      error: error || "Standard definition was not enabled.",
    };
  }
  return { ok: true, definition: payload.createdDefinition };
}

const TEMPLATE_PREFIX = "gid://shopify/StandardMetafieldDefinitionTemplate/";

export async function getStandardTemplates(admin, ownerType) {
  const templates = [];
  let after = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const response = await admin.graphql(`#graphql
      query StandardMetafieldCatalog($after: String) {
        standardMetafieldDefinitionTemplates(first: 100, after: $after) {
          nodes { id name namespace key description ownerTypes type { name } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { variables: { after } });
    const result = await response.json();
    const connection = result?.data?.standardMetafieldDefinitionTemplates;
    if (result?.errors?.length || !connection?.nodes || !connection?.pageInfo) {
      throw new Error(result?.errors?.[0]?.message || "Could not load standard definitions.");
    }
    templates.push(...connection.nodes.filter((template) => template.ownerTypes?.includes(ownerType)));
    hasNextPage = Boolean(connection.pageInfo.hasNextPage);
    if (hasNextPage && (!connection.pageInfo.endCursor || connection.pageInfo.endCursor === after)) {
      throw new Error("Standard definition pagination did not advance.");
    }
    after = connection.pageInfo.endCursor;
  }
  return templates;
}

export async function enableStandardTemplate(admin, templates, ownerType, id) {
  const selected = templates.find((item) => item.id === id && item.ownerTypes?.includes(ownerType));
  if (!id.startsWith(TEMPLATE_PREFIX) || !selected) {
    return { ok: false, status: 400, error: "Standard definition is unavailable for this resource." };
  }
  const response = await admin.graphql(`#graphql
    mutation EnableStandardMetafield($id: ID!, $ownerType: MetafieldOwnerType!) {
      standardMetafieldDefinitionEnable(id: $id, ownerType: $ownerType, pin: true, visibleToStorefrontApi: true) {
        createdDefinition { id name namespace key }
        userErrors { field message }
      }
    }
  `, { variables: { id, ownerType } });
  const result = await response.json();
  const payload = result?.data?.standardMetafieldDefinitionEnable;
  const error = result?.errors?.[0]?.message || payload?.userErrors?.[0]?.message;
  if (error || !payload?.createdDefinition?.id) {
    return { ok: false, status: 400, error: error || "Standard definition was not enabled." };
  }
  return { ok: true, definition: payload.createdDefinition };
}

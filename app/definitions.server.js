import {
  METAFIELD_API_VERSION,
  OWNER_TYPES,
  PUBLIC_OWNERS,
  VALUE_OWNERS,
  requireOwnerType,
  validateNamespace,
  storefrontAccess,
} from "./metafield-capabilities.js";
export async function graph(admin, query, variables = {}) {
  const response = await admin.graphql(query, { variables });
  const result = await response.json();
  if (result?.errors?.length || !result?.data)
    throw new Error(
      result?.errors?.[0]?.message || "Shopify did not return data.",
    );
  return result.data;
}
export async function getDefinitions(admin, ownerType) {
  requireOwnerType(ownerType);
  const definitions = [];
  let after = null;
  for (let page = 0; page < 100; page++) {
    const data = await graph(
      admin,
      `#graphql
      query DefinitionManager($ownerType: MetafieldOwnerType!, $after: String) {
        metafieldDefinitions(first: 100, after: $after, ownerType: $ownerType) {
          nodes { id name description namespace key ownerType pinnedPosition type { name } access { storefront } validations { name value } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { ownerType, after },
    );
    const connection = data.metafieldDefinitions;
    if (!Array.isArray(connection?.nodes) || !connection?.pageInfo)
      throw new Error("Definitions unavailable.");
    definitions.push(
      ...connection.nodes.map((field) => ({
        ...field,
        type: field.type?.name,
        storefront: field.access?.storefront || "NONE",
        editable: !field.namespace.startsWith("app--"),
      })),
    );
    if (!connection.pageInfo.hasNextPage) return definitions;
    if (
      !connection.pageInfo.endCursor ||
      after === connection.pageInfo.endCursor
    )
      throw new Error("Definition pagination did not advance.");
    after = connection.pageInfo.endCursor;
  }
  throw new Error("Definition pagination exceeded the safe limit.");
}
export async function getCapabilities(admin, ownerType) {
  const data = await graph(
    admin,
    `#graphql
    query DefinitionCapabilities {
      metafieldDefinitionTypes { name category supportedValidations { name type } }
      currentAppInstallation { accessScopes { handle } }
    }`,
  );
  if (
    !Array.isArray(data.metafieldDefinitionTypes) ||
    !Array.isArray(data.currentAppInstallation?.accessScopes)
  )
    throw new Error("Capability discovery unavailable.");
  // A successful owner query is evidence for reading only; Shopify still authorizes each mutation.
  const definitions = await getDefinitions(admin, ownerType);
  return {
    apiVersion: METAFIELD_API_VERSION,
    ownerType,
    owners: OWNER_TYPES.map((owner) => ({
      ownerType: owner,
      deprecated: owner === "MEDIA_IMAGE",
      publicContext: PUBLIC_OWNERS.has(owner),
      valueEditor: VALUE_OWNERS.has(owner),
    })),
    types: data.metafieldDefinitionTypes,
    scopes: data.currentAppInstallation.accessScopes.map(
      (scope) => scope.handle,
    ),
    definitionRead: "verified",
    definitionWrite: "shopify_authorizes_each_mutation",
    publicContext: PUBLIC_OWNERS.has(ownerType),
    valueEditor: VALUE_OWNERS.has(ownerType),
    fields: definitions,
  };
}
export function parseValidations(raw, typeInfo) {
  let validations;
  try {
    validations = JSON.parse(String(raw || "[]"));
  } catch {
    throw new RangeError("Validations must be a JSON array.");
  }
  const names = new Set(
    typeInfo.supportedValidations?.map((item) => item.name),
  );
  if (
    !Array.isArray(validations) ||
    validations.length > 20 ||
    validations.some(
      (item) =>
        !item ||
        !names.has(item.name) ||
        typeof item.value !== "string" ||
        item.value.length > 10000,
    ) ||
    new Set(validations.map((item) => item.name)).size !== validations.length
  )
    throw new RangeError(
      "Use unique validation names supported by the selected type, with string values.",
    );
  return validations.map(({ name, value }) => ({ name, value }));
}
export async function createDefinition(admin, ownerType, input) {
  ownerType = requireOwnerType(ownerType);
  const data = await graph(
    admin,
    `#graphql
query { metafieldDefinitionTypes { name supportedValidations { name type } } }`,
  );
  const typeInfo = data.metafieldDefinitionTypes?.find(
    (type) => type.name === input.type,
  );
  if (!typeInfo)
    throw new RangeError(
      "The selected type is not supported by this Shopify API.",
    );
  const name = String(input.name || "").trim();
  const key = String(input.key || "").trim();
  const description = String(input.description || "").trim();
  if (
    !name ||
    name.length > 255 ||
    !/^[a-zA-Z0-9_-]{2,64}$/.test(key) ||
    description.length > 65535
  )
    throw new RangeError(
      "Enter a name (1–255 characters), key (2–64 letters/numbers/underscores/hyphens) and a valid description.",
    );
  const definition = {
    ownerType,
    name,
    key,
    namespace: validateNamespace(input.namespace),
    description,
    type: typeInfo.name,
    validations: parseValidations(input.validations, typeInfo),
    pin: input.pin === "true",
    access: {
      storefront: storefrontAccess(ownerType, input.storefront || "NONE"),
    },
  };
  const result = await graph(
    admin,
    `#graphql
    mutation CreateDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) { createdDefinition { id namespace key ownerType } userErrors { field message } }
    }`,
    { definition },
  );
  const payload = result.metafieldDefinitionCreate;
  if (payload?.userErrors?.length)
    return { ok: false, error: payload.userErrors[0].message };
  const created = payload?.createdDefinition;
  if (
    !created?.id ||
    created.namespace !== definition.namespace ||
    created.key !== key ||
    created.ownerType !== ownerType
  )
    return {
      ok: false,
      error: "Shopify did not confirm the created definition identity.",
    };
  return { ok: true, definition: created };
}
export async function updateDefinition(admin, ownerType, fields, input) {
  ownerType = requireOwnerType(ownerType);
  const selected = fields.find(
    (field) =>
      field.id === input.id &&
      field.key === input.key &&
      field.namespace === input.namespace &&
      field.editable,
  );
  if (!selected)
    return {
      ok: false,
      error: "Editable definition not found for this resource.",
    };
  const name = String(input.name || "").trim();
  const description = String(input.description || "").trim();
  if (!name || name.length > 255 || description.length > 65535)
    throw new RangeError("Enter a valid definition name and description.");
  const definition = {
    ownerType,
    namespace: selected.namespace,
    key: selected.key,
    name,
    description,
    pin: input.pin === "true",
    access: {
      storefront: storefrontAccess(ownerType, input.storefront || "NONE"),
    },
  };
  if (input.validations !== undefined) {
    const types = await graph(
      admin,
      `#graphql
      query UpdateDefinitionValidationTypes { metafieldDefinitionTypes { name supportedValidations { name type } } }`,
    );
    const typeInfo = types.metafieldDefinitionTypes?.find(
      (item) => item.name === selected.type,
    );
    if (!typeInfo)
      throw new RangeError(
        "Validation capabilities for this type are unavailable.",
      );
    definition.validations = parseValidations(input.validations, typeInfo);
  }
  const data = await graph(
    admin,
    `#graphql
    mutation UpdateDefinitionMetadata($definition: MetafieldDefinitionUpdateInput!) {
      metafieldDefinitionUpdate(definition: $definition) { updatedDefinition { id name } userErrors { field message } }
    }`,
    { definition },
  );
  const payload = data.metafieldDefinitionUpdate;
  if (
    payload?.userErrors?.length ||
    payload?.updatedDefinition?.id !== selected.id
  )
    return {
      ok: false,
      error:
        payload?.userErrors?.[0]?.message ||
        "Shopify did not confirm the update.",
    };
  return { ok: true };
}

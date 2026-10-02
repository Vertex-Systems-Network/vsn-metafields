import { graph } from "./definitions.server.js";
import { encodeValue, editableValueType } from "./value-types.js";
import { verifyReferences } from "./metafield-values.server.js";

export function merchantMetaobjectType(type) {
  if (
    typeof type !== "string" ||
    !/^[a-z][a-z0-9_]{2,63}$/.test(type) ||
    type.startsWith("shopify") ||
    type.startsWith("app")
  )
    throw new RangeError(
      "Use a merchant-owned type of 3–64 lowercase letters, numbers or underscores. App and Shopify-owned types are read-only.",
    );
  return type;
}
export function metaobjectEditable(type) {
  try {
    merchantMetaobjectType(type);
    return true;
  } catch {
    return false;
  }
}
export async function listMetaobjectDefinitions(admin) {
  const definitions = [];
  let after = null;
  for (let page = 0; page < 100; page++) {
    const data = await graph(
      admin,
      `#graphql
      query MetaobjectManager($after: String) {
        metaobjectDefinitions(first:100,after:$after) {
          nodes { id name type description displayNameKey metaobjectsCount access { admin storefront } capabilities { publishable { enabled } } fieldDefinitions { key name required type { name } validations { name value } } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after },
    );
    const connection = data.metaobjectDefinitions;
    if (!Array.isArray(connection?.nodes) || !connection.pageInfo)
      throw new Error("Metaobject definitions unavailable.");
    definitions.push(
      ...connection.nodes.map((item) => ({
        ...item,
        editable: metaobjectEditable(item.type),
      })),
    );
    if (!connection.pageInfo.hasNextPage) return definitions;
    if (
      !connection.pageInfo.endCursor ||
      after === connection.pageInfo.endCursor
    )
      throw new Error("Metaobject definition pagination did not advance.");
    after = connection.pageInfo.endCursor;
  }
  throw new Error("Metaobject definition pagination exceeded its limit.");
}
export async function listMetaobjectEntries(admin, type, after = null) {
  if (typeof type !== "string" || type.length > 255 || !type)
    throw new RangeError("Select a metaobject definition.");
  const data = await graph(
    admin,
    `#graphql
    query MetaobjectEntries($type: String!, $after: String) {
      metaobjects(type:$type,first:20,after:$after) {
        nodes { id type handle displayName updatedAt capabilities { publishable { status } } fields { key value type } }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { type, after },
  );
  if (!Array.isArray(data.metaobjects?.nodes) || !data.metaobjects.pageInfo)
    throw new Error("Entries unavailable.");
  return data.metaobjects;
}
export async function readMetaobjectEntry(admin, id, type) {
  if (!/^gid:\/\/shopify\/Metaobject\/[0-9]+$/.test(id))
    throw new RangeError("Invalid metaobject entry.");
  const data = await graph(
    admin,
    `#graphql
    query SelectedMetaobject($id: ID!) { metaobject(id:$id) { id type handle updatedAt fields { key value type } capabilities { publishable { status } } } }`,
    { id },
  );
  if (data.metaobject?.id !== id || data.metaobject.type !== type)
    throw new RangeError("Entry not found for the selected definition.");
  return data.metaobject;
}
export async function createMetaobjectDefinition(admin, input, supportedTypes) {
  const type = merchantMetaobjectType(input.type),
    name = String(input.name || "").trim();
  if (!name || name.length > 255)
    throw new RangeError("Enter a definition name.");
  if (
    !Array.isArray(input.fields) ||
    input.fields.length < 1 ||
    input.fields.length > 25
  )
    throw new RangeError("Add 1–25 fields.");
  const keys = new Set();
  const fields = input.fields.map((item) => {
    if (
      !/^[a-z][a-z0-9_]{1,63}$/.test(item.key) ||
      keys.has(item.key) ||
      !item.name ||
      item.name.length > 255 ||
      !supportedTypes.includes(item.type) ||
      !editableValueType(item.type)
    )
      throw new RangeError(
        "Fields require unique keys, labels and supported types.",
      );
    keys.add(item.key);
    if (
      item.validations !== undefined &&
      (!Array.isArray(item.validations) ||
        item.validations.length > 10 ||
        item.validations.some(
          (v) => typeof v.name !== "string" || typeof v.value !== "string",
        ))
    )
      throw new RangeError("Invalid field validations.");
    return {
      key: item.key,
      name: item.name,
      type: item.type,
      required: item.required === true,
      validations: item.validations || [],
    };
  });
  const storefront = input.storefront || "NONE";
  if (!["NONE", "PUBLIC_READ"].includes(storefront))
    throw new RangeError("Invalid storefront access.");
  const data = await graph(
    admin,
    `#graphql
    mutation CreateMerchantMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition:$definition) { metaobjectDefinition { id type } userErrors { field message code } }
    }`,
    {
      definition: {
        name,
        type,
        description: String(input.description || "").slice(0, 2000),
        fieldDefinitions: fields,
        access: { storefront },
        capabilities: { publishable: { enabled: true } },
      },
    },
  );
  const payload = data.metaobjectDefinitionCreate;
  if (payload?.userErrors?.length)
    throw new RangeError(payload.userErrors[0].message);
  if (
    !payload?.metaobjectDefinition?.id ||
    payload.metaobjectDefinition.type !== type
  )
    throw new Error("Shopify did not confirm the definition identity.");
  return payload.metaobjectDefinition;
}
export async function updateMetaobjectDefinition(admin, definition, input) {
  merchantMetaobjectType(definition.type);
  const name = String(input.name || "").trim(),
    storefront = input.storefront || "NONE";
  if (
    !name ||
    name.length > 255 ||
    !["NONE", "PUBLIC_READ"].includes(storefront)
  )
    throw new RangeError("Enter a valid name and storefront access.");
  if (
    storefront === "PUBLIC_READ" &&
    definition.access?.storefront !== "PUBLIC_READ" &&
    definition.metaobjectsCount > 0 &&
    input.confirmPublicAccess !==
      `PUBLIC_ACCESS:${definition.id}:${definition.type}`
  )
    throw new RangeError(
      "Confirm public access for existing entries before changing this definition.",
    );
  const data = await graph(
    admin,
    `#graphql
    mutation UpdateMerchantMetaobjectDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
      metaobjectDefinitionUpdate(id:$id,definition:$definition) { metaobjectDefinition { id type } userErrors { field message code } }
    }`,
    {
      id: definition.id,
      definition: {
        name,
        description: String(input.description || "").slice(0, 2000),
        access: { storefront },
      },
    },
  );
  const payload = data.metaobjectDefinitionUpdate;
  if (payload?.userErrors?.length)
    throw new RangeError(payload.userErrors[0].message);
  if (
    payload?.metaobjectDefinition?.id !== definition.id ||
    payload.metaobjectDefinition.type !== definition.type
  )
    throw new Error("Shopify did not confirm the definition update.");
  return payload.metaobjectDefinition;
}
export async function saveMetaobjectEntry(admin, definition, input) {
  merchantMetaobjectType(definition.type);
  const handle = String(input.handle || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(handle))
    throw new RangeError(
      "Enter a lowercase handle using letters, numbers and hyphens.",
    );
  const status = input.status || "DRAFT";
  if (!["DRAFT", "ACTIVE"].includes(status))
    throw new RangeError("Invalid publishing status.");
  if (
    status === "ACTIVE" &&
    definition.access?.storefront === "PUBLIC_READ" &&
    input.confirmPublic !== `PUBLISH:${definition.type}:${handle}`
  )
    throw new RangeError("Confirm public publication of this entry.");
  if (
    !input.values ||
    typeof input.values !== "object" ||
    Array.isArray(input.values) ||
    Object.keys(input.values).some(
      (key) => !definition.fieldDefinitions.some((f) => f.key === key),
    )
  )
    throw new RangeError("Fields do not match the definition.");
  const fields = [];
  for (const field of definition.fieldDefinitions) {
    const raw = input.values[field.key];
    if (raw === undefined || raw === "") {
      if (!input.id && field.required)
        throw new RangeError(`${field.name} is required.`);
      continue; // Omitted fields are preserved during metadata/entry edits.
    }
    const value = encodeValue(field.type.name, raw, field.validations);
    await verifyReferences(admin, field.type.name, value);
    fields.push({ key: field.key, value });
  }
  if (!fields.length) throw new RangeError("Enter at least one field value.");
  const entry = {
    handle,
    fields,
    ...(definition.capabilities?.publishable?.enabled
      ? { capabilities: { publishable: { status } } }
      : {}),
  };
  let payload;
  if (input.id) {
    const existing = await readMetaobjectEntry(
      admin,
      input.id,
      definition.type,
    );
    if (!input.updatedAt || existing.updatedAt !== input.updatedAt)
      throw new RangeError("Entry changed. Reload before editing.");
    const data = await graph(
      admin,
      `#graphql
      mutation UpdateMerchantMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id:$id,metaobject:$metaobject) { metaobject { id type handle fields { key value } } userErrors { field message code } }
      }`,
      { id: input.id, metaobject: entry },
    );
    payload = data.metaobjectUpdate;
  } else {
    const data = await graph(
      admin,
      `#graphql
      mutation CreateMerchantMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject:$metaobject) { metaobject { id type handle fields { key value } } userErrors { field message code } }
      }`,
      { metaobject: { ...entry, type: definition.type } },
    );
    payload = data.metaobjectCreate;
  }
  if (payload?.userErrors?.length)
    throw new RangeError(payload.userErrors[0].message);
  const saved = payload?.metaobject;
  if (
    !saved?.id ||
    saved.type !== definition.type ||
    saved.handle !== handle ||
    (input.id && saved.id !== input.id) ||
    fields.some(
      (field) =>
        !saved.fields?.some(
          (f) => f.key === field.key && f.value === field.value,
        ),
    )
  )
    throw new Error("Shopify did not confirm the entry and field values.");
  return saved;
}
export async function removeMetaobjectEntry(admin, definition, input) {
  merchantMetaobjectType(definition.type);
  const entry = await readMetaobjectEntry(admin, input.id, definition.type);
  if (
    input.confirm !== `DELETE_ENTRY:${entry.id}:${entry.handle}` ||
    input.updatedAt !== entry.updatedAt
  )
    throw new RangeError(
      "Reload and confirm the selected entry deletion. References may become empty.",
    );
  const data = await graph(
    admin,
    `#graphql
    mutation DeleteMerchantMetaobject($id: ID!) { metaobjectDelete(id:$id) { deletedId userErrors { field message code } } }`,
    { id: entry.id },
  );
  if (data.metaobjectDelete?.userErrors?.length)
    throw new RangeError(data.metaobjectDelete.userErrors[0].message);
  if (data.metaobjectDelete?.deletedId !== entry.id)
    throw new Error("Entry deletion was not confirmed.");
}
export async function removeEmptyMetaobjectDefinition(
  admin,
  definition,
  confirm,
) {
  merchantMetaobjectType(definition.type);
  if (
    definition.metaobjectsCount !== 0 ||
    confirm !== `DELETE_EMPTY_DEFINITION:${definition.id}:${definition.type}`
  )
    throw new RangeError(
      "Only confirmed empty definitions can be removed. Remove selected entries first.",
    );
  // Check actual entry collection as well as the count before destructive mutation.
  if ((await listMetaobjectEntries(admin, definition.type)).nodes.length)
    throw new RangeError("Definition still contains entries.");
  const data = await graph(
    admin,
    `#graphql
    mutation DeleteEmptyMetaobjectDefinition($id: ID!) { metaobjectDefinitionDelete(id:$id) { deletedId userErrors { field message code } } }`,
    { id: definition.id },
  );
  if (data.metaobjectDefinitionDelete?.userErrors?.length)
    throw new RangeError(data.metaobjectDefinitionDelete.userErrors[0].message);
  if (data.metaobjectDefinitionDelete?.deletedId !== definition.id)
    throw new Error("Definition deletion was not confirmed.");
}

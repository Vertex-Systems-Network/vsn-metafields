import { authenticate } from "../shopify.server";
import { hasActivePlan } from "../active-plan.server";
import { validateValueInput, mutateValue } from "../metafield-values.server";

const OWNER_NAMES = { PRODUCT: "Product", PRODUCTVARIANT: "ProductVariant", COLLECTION: "Collection" };
const NAMESPACE = "vsn_metafields";

function ownerFrom(value) {
  const owner = String(value || "").toUpperCase();
  if (!OWNER_NAMES[owner]) throw new RangeError("Unsupported resource owner.");
  return owner;
}

async function graph(admin, query, variables) {
  const response = await admin.graphql(query, { variables });
  const result = await response.json();
  if (result?.errors?.length || !result?.data) throw new Error(result?.errors?.[0]?.message || "Shopify query failed.");
  return result.data;
}

async function findDefinition(admin, ownerType, key, namespace = NAMESPACE) {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(key) || !/^[a-zA-Z0-9_-]{3,255}$/.test(namespace)) throw new RangeError("Invalid definition key.");
  let after = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const data = await graph(admin, `#graphql
      query ValueDefinitions($ownerType: MetafieldOwnerType!, $after: String) {
        metafieldDefinitions(ownerType: $ownerType, first: 100, after: $after) {
          nodes { namespace key type { name } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { ownerType, after });
    const connection = data.metafieldDefinitions;
    if (!Array.isArray(connection?.nodes) || !connection?.pageInfo) throw new Error("Definitions unavailable.");
    const definition = connection.nodes.find((item) => item.namespace === namespace && item.key === key);
    if (definition) return { namespace: definition.namespace, key: definition.key, type: definition.type?.name };
    hasNextPage = Boolean(connection.pageInfo.hasNextPage);
    if (hasNextPage && (!connection.pageInfo.endCursor || after === connection.pageInfo.endCursor)) throw new Error("Definition pagination did not advance.");
    after = connection.pageInfo.endCursor;
  }
  return null;
}

async function verifiedResource(admin, ownerType, ownerId, namespace, key) {
  if (!new RegExp(`^gid://shopify/${OWNER_NAMES[ownerType]}/[0-9]+$`).test(ownerId)) {
    throw new RangeError("Resource does not match the selected owner type.");
  }
  const data = await graph(admin, `#graphql
    query VsnResourceValue($id: ID!, $namespace: String!, $key: String!) {
      node(id: $id) {
        __typename
        ... on Product { id metafield(namespace: $namespace, key: $key) { value type } }
        ... on ProductVariant { id metafield(namespace: $namespace, key: $key) { value type } }
        ... on Collection { id metafield(namespace: $namespace, key: $key) { value type } }
      }
    }
  `, { id: ownerId, namespace, key });
  if (data.node?.__typename !== OWNER_NAMES[ownerType] || data.node?.id !== ownerId) {
    throw new RangeError("Resource was not found for this owner.");
  }
  return data.node.metafield;
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    if (!(await hasActivePlan(admin))) return Response.json({ ok: false, error: "An active plan is required." }, { status: 403 });
    const params = new URL(request.url).searchParams;
    const ownerType = ownerFrom(params.get("ownerType"));
    if (params.get("mode") === "resources") {
      const search = String(params.get("search") || "").trim().slice(0, 60);
      // Shopify search grammar is bounded to title text, with syntax punctuation removed.
      const safeSearch = search.replace(/[^\p{L}\p{N} _-]/gu, "").trim();
      const query = safeSearch ? `title:${safeSearch}` : null;
      const operations = {
        PRODUCT: `#graphql
query ($query: String) { products(first: 20, query: $query) { nodes { id title } } }`,
        PRODUCTVARIANT: `#graphql
query ($query: String) { productVariants(first: 20, query: $query) { nodes { id title product { title } } } }`,
        COLLECTION: `#graphql
query ($query: String) { collections(first: 20, query: $query) { nodes { id title } } }`,
      };
      const data = await graph(admin, operations[ownerType], { query });
      const nodes = data[ownerType === "PRODUCTVARIANT" ? "productVariants" : ownerType === "PRODUCT" ? "products" : "collections"]?.nodes;
      if (!Array.isArray(nodes)) throw new Error("Resources unavailable.");
      return Response.json({ ok: true, ownerType, resources: nodes.map((item) => ({
        id: item.id, title: item.product ? `${item.product.title} / ${item.title}` : item.title,
      })) });
    }
    const ownerId = String(params.get("ownerId") || "");
    const key = String(params.get("key") || "");
    const definition = await findDefinition(admin, ownerType, key, String(params.get("namespace") || NAMESPACE));
    if (!definition) return Response.json({ ok: false, error: "Definition not found." }, { status: 404 });
    const metafield = await verifiedResource(admin, ownerType, ownerId, definition.namespace, key);
    return Response.json({ ok: true, ownerType, ownerId, namespace: definition.namespace, key, type: definition.type, value: metafield?.value ?? null });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || "Value lookup failed." }, { status: error instanceof RangeError ? 400 : 500 });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  if (request.method.toUpperCase() !== "POST") return Response.json({ ok: false, error: "Method not allowed." }, { status: 405, headers: { Allow: "POST" } });
  try {
    if (!(await hasActivePlan(admin))) return Response.json({ ok: false, error: "An active plan is required." }, { status: 403 });
    const form = await request.formData();
    const ownerType = ownerFrom(form.get("ownerType"));
    const ownerId = String(form.get("ownerId") || "");
    const key = String(form.get("key") || "");
    const command = String(form.get("actionType") || "");
    if (command !== "set" && command !== "delete") throw new RangeError("Unsupported value action.");
    const definition = await findDefinition(admin, ownerType, key, String(form.get("namespace") || NAMESPACE));
    if (!definition) return Response.json({ ok: false, error: "Definition not found." }, { status: 404 });
    const existing = await verifiedResource(admin, ownerType, ownerId, definition.namespace, key);
    if (command === "delete" && !existing) return Response.json({ ok: false, error: "No value to remove." }, { status: 404 });
    if (command === "delete" && form.get("confirm") !== `REMOVE_VALUE:${ownerId}:${definition.namespace}:${key}`) {
      throw new RangeError("Confirm the selected value removal.");
    }
    const value = command === "set" ? validateValueInput(ownerType, ownerId, definition, form.get("value")) : undefined;
    const result = await mutateValue(admin, { action: command, ownerId, definition, value });
    if (!result.ok) return Response.json(result, { status: 400 });
    return Response.json({ ok: true, success: true, message: command === "set" ? "Value saved." : "Value removed." });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || "Value action failed." }, { status: error instanceof RangeError ? 400 : 500 });
  }
};

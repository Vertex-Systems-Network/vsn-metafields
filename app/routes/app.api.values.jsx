import { authenticate } from "../shopify.server";
import { hasActivePlan } from "../active-plan.server";
import { graph } from "../definitions.server";
import {
  validateValueInput,
  mutateValue,
  findValueDefinition,
  readResourceValue,
  verifyReferences,
  OWNER_GIDS,
} from "../metafield-values.server";
import { editableValueType } from "../value-types";
import { getPlanEntitlement, assertListValue } from "../plan-limits.server";

async function listValueResources(admin, ownerType, search = "") {
  if (!OWNER_GIDS[ownerType])
    throw new RangeError("Unsupported resource owner.");
  // Query stays a GraphQL variable; preserve Shopify search operators and quotes.
  const query = String(search || "").trim() || null;
  if (query && query.length > 120)
    throw new RangeError(
      "Keep the Shopify search query within 120 characters.",
    );
  const queries = {
    PRODUCT: `#graphql
      query ValueProducts($query: String) { products(first:20,query:$query) { nodes { id title } } }`,
    PRODUCTVARIANT: `#graphql
      query ValueVariants($query: String) { productVariants(first:20,query:$query) { nodes { id title product { title } } } }`,
    COLLECTION: `#graphql
      query ValueCollections($query: String) { collections(first:20,query:$query) { nodes { id title } } }`,
  };
  const data = await graph(admin, queries[ownerType], { query });
  const nodes =
    data[
      {
        PRODUCT: "products",
        PRODUCTVARIANT: "productVariants",
        COLLECTION: "collections",
      }[ownerType]
    ]?.nodes;
  if (!Array.isArray(nodes)) throw new Error("Resources unavailable.");
  return nodes.map((item) => ({
    id: item.id,
    title: item.product ? `${item.product.title} / ${item.title}` : item.title,
  }));
}
const reply = (payload, status = 200) =>
  Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const params = new URL(request.url).searchParams;
  const ownerType = String(params.get("ownerType") || "PRODUCT").toUpperCase();
  const identity = {
    ownerType,
    ownerId: String(params.get("ownerId") || ""),
    namespace: String(params.get("namespace") || "vsn_metafields"),
    key: String(params.get("key") || ""),
  };
  try {
    if (!(await hasActivePlan(admin)))
      return reply(
        { ...identity, ok: false, error: "An active plan is required." },
        403,
      );
    if (params.get("mode") === "resources")
      return reply({
        ok: true,
        ownerType,
        resources: await listValueResources(
          admin,
          ownerType,
          params.get("search"),
        ),
      });
    const ownerId = String(params.get("ownerId") || "");
    const namespace = String(params.get("namespace") || "vsn_metafields"),
      key = String(params.get("key") || "");
    const definition = await findValueDefinition(
      admin,
      ownerType,
      namespace,
      key,
    );
    const metafield = await readResourceValue(
      admin,
      ownerType,
      ownerId,
      namespace,
      key,
    );
    return reply({
      ok: true,
      ownerType,
      ownerId,
      namespace,
      key,
      type: definition.type,
      editable: editableValueType(definition.type),
      value: metafield?.value ?? null,
      compareDigest: metafield?.compareDigest ?? null,
    });
  } catch (error) {
    return reply(
      {
        ...identity,
        ok: false,
        error: error.message || "Value lookup failed.",
      },
      error instanceof RangeError ? 400 : 502,
    );
  }
};
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  if (request.method !== "POST")
    return Response.json(
      { ok: false, error: "Method not allowed." },
      { status: 405, headers: { Allow: "POST" } },
    );
  let identity = {};
  try {
    const form = await request.formData();
    const ownerType = String(form.get("ownerType") || "").toUpperCase(),
      ownerId = String(form.get("ownerId") || "");
    const namespace = String(form.get("namespace") || "vsn_metafields"),
      key = String(form.get("key") || "");
    identity = { ownerType, ownerId, namespace, key };
    const plan = await getPlanEntitlement(admin);
    const command = String(form.get("actionType") || "");
    if (!["set", "delete"].includes(command))
      throw new RangeError("Unsupported value action.");
    const definition = await findValueDefinition(
      admin,
      ownerType,
      namespace,
      key,
    );
    const existing = await readResourceValue(
      admin,
      ownerType,
      ownerId,
      namespace,
      key,
    );
    if (!form.has("compareDigest"))
      throw new RangeError("Reload the value before saving.");
    const expected = form.get("compareDigest") || null;
    if (expected !== (existing?.compareDigest ?? null))
      return reply(
        {
          ...identity,
          ok: false,
          error: "Value changed since you loaded it. Reload before editing.",
          code: "value_conflict",
        },
        409,
      );
    if (
      command === "delete" &&
      (!existing ||
        form.get("confirm") !== `REMOVE_VALUE:${ownerId}:${namespace}:${key}`)
    )
      throw new RangeError("Confirm the selected value removal.");
    const value =
      command === "set"
        ? validateValueInput(ownerType, ownerId, definition, form.get("value"))
        : undefined;
    if (command === "set") {
      assertListValue(plan, definition.type, value);
      await verifyReferences(admin, definition.type, value);
    }
    const result = await mutateValue(admin, {
      action: command,
      ownerId,
      definition,
      value,
      compareDigest: expected,
    });
    if (!result.ok)
      return reply(
        { ...result, ...identity },
        result.code === "INVALID_COMPARE_DIGEST" ? 409 : 400,
      );
    return reply({
      ok: true,
      success: true,
      ownerType,
      ownerId,
      namespace,
      key,
      message: command === "set" ? "Value saved." : "Value removed.",
    });
  } catch (error) {
    return reply(
      {
        ...identity,
        ok: false,
        error: error.message || "Value action failed.",
        code: error.code,
      },
      error.code === "plan_limit"
        ? 403
        : error instanceof RangeError
          ? 400
          : 502,
    );
  }
};

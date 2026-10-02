import { authenticate } from "../shopify.server";
import { hasActivePlan } from "../active-plan.server";
import { getDefinitions, graph } from "../definitions.server.js";

const NAMESPACE = "vsn_metafields";
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return Response.json(
    { ok: false, error: "Method not allowed." },
    { status: 405, headers: { Allow: "POST" } },
  );
};
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  if (request.method.toUpperCase() !== "POST")
    return Response.json(
      { ok: false, error: "Method not allowed." },
      { status: 405, headers: { Allow: "POST" } },
    );
  const results = [];
  try {
    if (!(await hasActivePlan(admin)))
      return Response.json(
        { ok: false, error: "An active plan is required." },
        { status: 403 },
      );
    const fields = (await getDefinitions(admin, "PRODUCT")).filter(
      (field) => field.namespace === NAMESPACE,
    );
    for (const field of fields) {
      if (Number.isInteger(field.pinnedPosition)) {
        results.push({ key: field.key, status: "already pinned" });
        continue;
      }
      // Pinning must never change an existing field's storefront visibility.
      const data = await graph(
        admin,
        `#graphql
        mutation PinLegacyDefinition($namespace: String!, $key: String!, $ownerType: MetafieldOwnerType!) {
          metafieldDefinitionUpdate(definition: { namespace: $namespace, key: $key, ownerType: $ownerType, pin: true }) {
            updatedDefinition { id pinnedPosition }
            userErrors { field message }
          }
        }`,
        { namespace: field.namespace, key: field.key, ownerType: "PRODUCT" },
      );
      const payload = data.metafieldDefinitionUpdate;
      if (
        payload?.userErrors?.length ||
        payload?.updatedDefinition?.id !== field.id ||
        !Number.isInteger(payload.updatedDefinition.pinnedPosition)
      ) {
        throw new Error(
          payload?.userErrors?.[0]?.message ||
            "Shopify did not confirm pinning.",
        );
      }
      results.push({ key: field.key, status: "pinned" });
    }
    return Response.json({ ok: true, results });
  } catch (error) {
    return Response.json(
      { ok: false, results, error: error.message || "Pinning failed." },
      { status: 502 },
    );
  }
};

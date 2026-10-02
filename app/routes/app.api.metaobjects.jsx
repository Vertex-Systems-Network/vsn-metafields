import { authenticate } from "../shopify.server";
import { hasActivePlan } from "../active-plan.server";
import { graph } from "../definitions.server";
import {
  getPlanEntitlement,
  assertPlanCount,
  assertListValue,
  assertPlanFeature,
} from "../plan-limits.server";
import {
  listMetaobjectDefinitions,
  listMetaobjectEntries,
  createMetaobjectDefinition,
  updateMetaobjectDefinition,
  saveMetaobjectEntry,
  removeMetaobjectEntry,
  removeEmptyMetaobjectDefinition,
} from "../metaobjects.server";
import {
  featureJson,
  featureError,
  boundedJson,
} from "../feature-request.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    if (!(await hasActivePlan(admin)))
      return featureJson(
        { ok: false, error: "An active plan is required." },
        403,
      );
    const params = new URL(request.url).searchParams;
    if (params.get("type"))
      return featureJson({
        ok: true,
        type: params.get("type"),
        ...(await listMetaobjectEntries(
          admin,
          params.get("type"),
          params.get("after"),
        )),
      });
    const plan = await getPlanEntitlement(admin);
    const definitions = await listMetaobjectDefinitions(admin);
    const data = await graph(
      admin,
      `#graphql
      query MetaobjectFieldTypes { metafieldDefinitionTypes { name supportedValidations { name type } } }`,
    );
    return featureJson({
      ok: true,
      definitions,
      types: data.metafieldDefinitionTypes,
      plan,
    });
  } catch (error) {
    return featureError(error);
  }
};
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  if (request.method !== "POST")
    return featureJson({ ok: false, error: "Use POST." }, 405);
  try {
    const plan = await getPlanEntitlement(admin);
    const input = await boundedJson(request);
    let saved;
    if (input.action === "createDefinition") {
      if (input.storefront === "PUBLIC_READ")
        assertPlanFeature(
          plan,
          "publicMetaobjects",
          "Public metaobject access",
        );
      assertPlanCount(
        plan,
        "metaobjectFields",
        input.fields?.length,
        "fields per new metaobject definition",
      );
      const data = await graph(
        admin,
        `#graphql
        query MetaobjectCreateFieldTypes { metafieldDefinitionTypes { name } }`,
      );
      saved = await createMetaobjectDefinition(
        admin,
        input,
        data.metafieldDefinitionTypes.map((t) => t.name),
      );
    } else {
      const definition = (await listMetaobjectDefinitions(admin)).find(
        (d) => d.id === input.definitionId && d.type === input.type,
      );
      if (!definition || !definition.editable)
        throw new RangeError("Editable merchant-owned definition not found.");
      if (input.action === "updateDefinition") {
        if (
          input.storefront === "PUBLIC_READ" &&
          definition.access?.storefront !== "PUBLIC_READ"
        )
          assertPlanFeature(
            plan,
            "publicMetaobjects",
            "Enabling public metaobject access",
          );
        saved = await updateMetaobjectDefinition(admin, definition, input);
      } else if (input.action === "saveEntry") {
        if (
          definition.access?.storefront === "PUBLIC_READ" &&
          (input.status === "ACTIVE" ||
            !definition.capabilities?.publishable?.enabled)
        )
          assertPlanFeature(
            plan,
            "publicMetaobjects",
            "Saving published public metaobject entries",
          );
        for (const field of definition.fieldDefinitions) {
          if (
            input.values?.[field.key] !== undefined &&
            input.values[field.key] !== ""
          )
            assertListValue(plan, field.type.name, input.values[field.key]);
        }
        saved = await saveMetaobjectEntry(admin, definition, input);
      } else if (input.action === "deleteEntry")
        await removeMetaobjectEntry(admin, definition, input);
      else if (input.action === "deleteDefinition")
        await removeEmptyMetaobjectDefinition(admin, definition, input.confirm);
      else throw new RangeError("Unsupported metaobject action.");
    }
    return featureJson({
      ok: true,
      success: true,
      type: input.type,
      saved,
      message: "Metaobject action confirmed.",
    });
  } catch (error) {
    return featureError(error);
  }
};

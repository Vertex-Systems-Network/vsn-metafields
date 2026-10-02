import { authenticate } from "../shopify.server";
import { hasActivePlan } from "../active-plan.server";
import { graph } from "../definitions.server";
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
    if (!(await hasActivePlan(admin)))
      return featureJson(
        { ok: false, error: "An active plan is required." },
        403,
      );
    const input = await boundedJson(request);
    let saved;
    if (input.action === "createDefinition") {
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
      if (input.action === "updateDefinition")
        saved = await updateMetaobjectDefinition(admin, definition, input);
      else if (input.action === "saveEntry")
        saved = await saveMetaobjectEntry(admin, definition, input);
      else if (input.action === "deleteEntry")
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

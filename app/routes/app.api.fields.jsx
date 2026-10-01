import { authenticate } from "../shopify.server";
import { hasActivePlan } from "../active-plan.server";
import { requireOwnerType, storefrontAccess } from "../metafield-capabilities.js";
import { getDefinitions, getCapabilities, createDefinition, updateDefinition } from "../definitions.server.js";
import { getStandardTemplates, enableStandardTemplate } from "../standard-definitions.server.js";
import { removeDefinition } from "../definition-removal.server.js";

const NAMESPACE = "vsn_metafields";
const failure = (error, status = 400, ownerType) => Response.json({ ok: false, success: false, fields: [], ownerType, error }, { status });
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  let ownerType;
  try {
    if (!(await hasActivePlan(admin))) return failure("An active plan is required.", 403);
    const params = new URL(request.url).searchParams;
    ownerType = requireOwnerType(params.get("ownerType"));
    if (params.get("catalog") === "standard") {
      const [templates, fields] = await Promise.all([getStandardTemplates(admin, ownerType), getDefinitions(admin, ownerType)]);
      const existing = new Set(fields.map(field => `${field.namespace}.${field.key}`));
      return Response.json({ ok: true, ownerType, templates: templates.map(item => ({ ...item, type: item.type?.name, enabled: existing.has(`${item.namespace}.${item.key}`) })) });
    }
    const capabilities = await getCapabilities(admin, ownerType);
    return Response.json({ ok: true, ownerType, ...capabilities });
  } catch (error) { return failure(error.message || "Definitions are unavailable for this owner. Check app permissions.", error instanceof RangeError ? 400 : 502, ownerType); }
};
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  if (request.method.toUpperCase() !== "POST") return Response.json({ ok: false, error: "Method not allowed." }, { status: 405, headers: { Allow: "POST" } });
  let ownerType;
  try {
    if (!(await hasActivePlan(admin))) return failure("An active plan is required.", 403);
    const form = await request.formData();
    ownerType = requireOwnerType(form.get("ownerType"));
    const command = String(form.get("actionType") || "create");
    const input = Object.fromEntries(form.entries());
    let result;
    if (command === "create") result = await createDefinition(admin, ownerType, input);
    else if (command === "enable-standard") {
      const templates = await getStandardTemplates(admin, ownerType);
      const access = storefrontAccess(ownerType, String(form.get("storefront") || "NONE"));
      result = await enableStandardTemplate(admin, templates, ownerType, String(form.get("templateId") || ""), access);
    } else if (command === "update") result = await updateDefinition(admin, ownerType, await getDefinitions(admin, ownerType), input);
    else if (command === "delete") {
      const fields = await getDefinitions(admin, ownerType);
      const selected = fields.find(field => field.id === input.id && field.namespace === input.namespace && field.key === input.key && field.editable);
      if (!selected || input.confirm !== `DELETE_DEFINITION:${ownerType}:${selected.namespace}:${selected.key}`) return failure("Confirm the selected definition identity.");
      result = await removeDefinition(admin, [selected], input);
    } else if (command === "reset") {
      if (input.confirm !== `RESET_VSN_METAFIELDS:${ownerType}`) return failure("Reset confirmation is required.");
      const fields = (await getDefinitions(admin, ownerType)).filter(field => field.namespace === NAMESPACE);
      let deletedCount = 0;
      for (const field of fields) {
        const removed = await removeDefinition(admin, [field], field);
        if (!removed.ok) return failure(`${deletedCount} removed before failure: ${removed.error}`);
        deletedCount++;
      }
      result = { ok: true, deletedCount };
    } else return failure("Unknown actionType.");
    if (!result.ok) return failure(result.error);
    return Response.json({ ...result, ok: true, success: true, ownerType, message: command === "delete" || command === "reset" ? "Definition removed; existing values retained." : "Definition saved." });
  } catch (error) { return failure(error.message || "Definition action failed.", error instanceof RangeError ? 400 : 502, ownerType); }
};

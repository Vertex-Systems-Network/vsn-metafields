import { authenticate } from "../shopify.server";
import { hasActivePlan } from "../active-plan.server";
import { removeDefinition } from "../definition-removal.server";
import { renameDefinition } from "../definition-update.server";
import { getStandardTemplates, enableStandardTemplate } from "../standard-definitions.server";

const NAMESPACE = "vsn_metafields";
const ALLOWED_OWNERS = new Set(["PRODUCT", "PRODUCTVARIANT", "COLLECTION"]);
const ALLOWED_TYPES = new Set([
  "single_line_text_field",
  "multi_line_text_field",
  "number_integer",
  "date",
  "boolean",
  "url",
]);

function requireOwnerType(value) {
  const ownerType = String(value || "PRODUCT").toUpperCase();
  if (!ALLOWED_OWNERS.has(ownerType)) {
    throw new RangeError("Unsupported metafield owner type.");
  }
  return ownerType;
}

const planRequiredResponse = () => Response.json(
  { ok: false, success: false, fields: [], error: "An active plan is required." },
  { status: 403 }
);

async function getMetafieldDefinitions(admin, ownerType) {
  const definitions = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await admin.graphql(
      `#graphql
      query GetMetafieldDefinitions($after: String, $ownerType: MetafieldOwnerType!) {
        metafieldDefinitions(first: 100, after: $after, ownerType: $ownerType) {
          nodes {
            id
            name
            key
            namespace
            type {
              name
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`,
      { variables: { after, ownerType } }
    );

    const data = await res.json();

    if (data?.errors?.length) {
      throw new Error(
        data.errors[0]?.message || "Failed to fetch metafield definitions."
      );
    }

    const connection = data?.data?.metafieldDefinitions;
    if (!Array.isArray(connection?.nodes) || !connection?.pageInfo) {
      throw new Error("Could not load metafield definitions.");
    }
    definitions.push(...connection.nodes);

    hasNextPage = Boolean(connection?.pageInfo?.hasNextPage);
    const nextCursor = connection.pageInfo.endCursor;
    if (hasNextPage && (!nextCursor || nextCursor === after)) {
      throw new Error("Definition pagination did not advance.");
    }
    after = nextCursor;
  }

  return definitions.map((field) => ({
      id: field.id,
      name: field.name,
      key: field.key,
      namespace: field.namespace,
      type: field.type?.name,
    }));
}

async function getVsnMetafieldDefinitions(admin, ownerType) {
  return (await getMetafieldDefinitions(admin, ownerType)).filter((field) => field.namespace === NAMESPACE);
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    if (!(await hasActivePlan(admin))) return planRequiredResponse();
    const ownerType = requireOwnerType(new URL(request.url).searchParams.get("ownerType"));
    if (new URL(request.url).searchParams.get("catalog") === "standard") {
      const [templates, definitions] = await Promise.all([
        getStandardTemplates(admin, ownerType), getMetafieldDefinitions(admin, ownerType),
      ]);
      const existing = new Set(definitions.map((field) => `${field.namespace}.${field.key}`));
      return Response.json({ ok: true, ownerType, templates: templates.map((item) => ({
        id: item.id, name: item.name, namespace: item.namespace, key: item.key,
        type: item.type?.name, enabled: existing.has(`${item.namespace}.${item.key}`),
      })) });
    }
    const fields = await getVsnMetafieldDefinitions(admin, ownerType);

    return Response.json({
      ok: true,
      fields,
      ownerType,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        fields: [],
        error: error?.message || "Failed to load fields.",
      },
      { status: error instanceof RangeError ? 400 : 500 }
    );
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  if (request.method.toUpperCase() !== "POST") {
    return Response.json(
      {
        ok: false,
        success: false,
        error: "Method not allowed.",
      },
      {
        status: 405,
        headers: { Allow: "POST" },
      }
    );
  }

  try {
    if (!(await hasActivePlan(admin))) return planRequiredResponse();
    const formData = await request.formData();
    const actionType = String(formData.get("actionType") || "create");
    const ownerType = requireOwnerType(formData.get("ownerType"));

    if (actionType === "enable-standard") {
      const id = String(formData.get("templateId") || "");
      const templates = await getStandardTemplates(admin, ownerType);
      const enabled = await enableStandardTemplate(admin, templates, ownerType, id);
      if (!enabled.ok) return Response.json({ ok: false, success: false, error: enabled.error }, { status: enabled.status });
      return Response.json({ ok: true, success: true, message: `${enabled.definition.name} standard definition enabled for ${ownerType}.` });
    }

    if (actionType === "update") {
      const definitions = await getVsnMetafieldDefinitions(admin, ownerType);
      const updated = await renameDefinition(admin, definitions, ownerType, {
        id: String(formData.get("id") || ""), key: String(formData.get("key") || ""),
        name: formData.get("name"),
      });
      if (!updated.ok) return Response.json({ ok: false, success: false, error: updated.error }, { status: updated.status });
      return Response.json({ ok: true, success: true, message: `${updated.name} updated.` });
    }

    if (actionType === "delete") {
      const id = String(formData.get("id") || "");
      const key = String(formData.get("key") || "");
      if (!id || !key || formData.get("confirm") !== `DELETE_VSN_METAFIELD:${key}`) {
        return Response.json({ ok: false, success: false, error: "Definition confirmation is required." }, { status: 400 });
      }

      const definitions = await getVsnMetafieldDefinitions(admin, ownerType);
      const removal = await removeDefinition(admin, definitions, { id, key });
      if (!removal.ok) return Response.json({ ok: false, success: false, error: removal.error }, { status: removal.status });
      return Response.json({ ok: true, success: true, message: `${key} definition removed from ${ownerType}; associated values were retained.` });
    }

    if (actionType === "reset") {
      if (formData.get("confirm") !== `RESET_VSN_METAFIELDS:${ownerType}`) {
        return Response.json(
          {
            ok: false,
            success: false,
            error: "Reset confirmation is required.",
          },
          { status: 400 }
        );
      }

      const fields = await getVsnMetafieldDefinitions(admin, ownerType);
      let deletedCount = 0;
      const deleteErrors = [];

      for (const field of fields) {
        const deleteRes = await admin.graphql(
          `#graphql
          mutation DeleteMetafieldDefinition($id: ID!) {
            metafieldDefinitionDelete(
              id: $id
              deleteAllAssociatedMetafields: false
            ) {
              deletedDefinitionId
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              id: field.id,
            },
          }
        );

        const deleteData = await deleteRes.json();

        if (deleteData?.errors?.length) {
          deleteErrors.push(
            deleteData.errors[0]?.message || "Delete GraphQL error."
          );
          continue;
        }

        const userErrors =
          deleteData?.data?.metafieldDefinitionDelete?.userErrors || [];

        if (userErrors.length > 0) {
          deleteErrors.push(userErrors[0]?.message || "Delete user error.");
          continue;
        }

        deletedCount++;
      }

      if (deleteErrors.length > 0) {
        return Response.json(
          {
            ok: false,
            success: false,
            deletedCount,
            failedCount: deleteErrors.length,
            error: deleteErrors[0],
          },
          { status: 400 }
        );
      }

      return Response.json({
        ok: true,
        success: true,
        message: `${deletedCount} ${ownerType} metafield definition(s) deleted.`,
      });
    }

    if (actionType !== "create") {
      return Response.json(
        {
          ok: false,
          success: false,
          error: "Unknown actionType.",
        },
        { status: 400 }
      );
    }

    const name = formData.get("name");
    const key = formData.get("key");
    const type = String(formData.get("type") || "");

    if (!name || !key || !type) {
      return Response.json(
        {
          ok: false,
          success: false,
          error: "Missing fields.",
        },
        { status: 400 }
      );
    }

    const cleanName = String(name).trim();
    const cleanKey = String(key)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    if (!cleanName || !cleanKey) {
      return Response.json(
        {
          ok: false,
          success: false,
          error: "Invalid field name or key.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(type)) {
      return Response.json(
        {
          ok: false,
          success: false,
          error: "Unsupported metafield type.",
        },
        { status: 400 }
      );
    }

    const mutation = await admin.graphql(
      `#graphql
      mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
            name
            namespace
            key
            type {
              name
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          definition: {
            name: cleanName,
            key: cleanKey,
            namespace: NAMESPACE,
            type,
            ownerType,
            pin: true,
            access: {
              storefront: "PUBLIC_READ",
            },
          },
        },
      }
    );

    const result = await mutation.json();

    if (result?.errors?.length) {
      return Response.json(
        {
          ok: false,
          success: false,
          error: result.errors[0]?.message || "Create GraphQL error.",
        },
        { status: 400 }
      );
    }

    const userErrors =
      result?.data?.metafieldDefinitionCreate?.userErrors || [];

    if (userErrors.length > 0) {
      return Response.json(
        {
          ok: false,
          success: false,
          error: userErrors[0]?.message || "Failed to create metafield.",
        },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      success: true,
      message: `${ownerType} metafield created successfully.`,
      metafield: result?.data?.metafieldDefinitionCreate?.createdDefinition,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        success: false,
        error: error?.message || "Fields action failed.",
      },
      { status: 500 }
    );
  }
};

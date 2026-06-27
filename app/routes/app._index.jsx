import { useEffect, useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  console.log("Authenticated shop:", session.shop);
  console.log("Session scope:", session.scope);

  return {
    shop: session.shop,
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const actionType = formData.get("actionType");

  try {
    // RESET ALL FIELDS
    if (actionType === "reset_all") {
      const res = await admin.graphql(`#graphql
        query {
          metafieldDefinitions(first: 100, ownerType: PRODUCT) {
            nodes {
              id
              namespace
              key
            }
          }
        }
      `);

      const data = await res.json();

      if (data?.errors?.length) {
        console.error("Reset query errors:", data.errors);
        return {
          success: false,
          error: data.errors[0]?.message || "Failed to fetch metafield definitions.",
        };
      }

      const definitions = data?.data?.metafieldDefinitions?.nodes || [];

      const toDelete = definitions.filter(
        (field) => field.namespace === "vsn_metafields"
      );

      let deletedCount = 0;
      const deleteErrors = [];

      for (const field of toDelete) {
        const deleteRes = await admin.graphql(
          `#graphql
          mutation DeleteMetafieldDefinition($id: ID!) {
            metafieldDefinitionDelete(
              id: $id,
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
          console.error("Delete GraphQL errors:", deleteData.errors);
          deleteErrors.push(deleteData.errors[0]?.message);
          continue;
        }

        const userErrors =
          deleteData?.data?.metafieldDefinitionDelete?.userErrors || [];

        if (userErrors.length > 0) {
          console.error("Delete user errors:", userErrors);
          deleteErrors.push(userErrors[0]?.message);
          continue;
        }

        deletedCount++;
      }

      if (deleteErrors.length > 0) {
        return {
          success: false,
          error: deleteErrors[0] || "Some fields could not be deleted.",
        };
      }

      return {
        success: true,
        message: `${deletedCount} metafield definition(s) deleted.`,
      };
    }

    // CREATE FIELD
    const name = formData.get("name");
    const key = formData.get("key");
    const type = formData.get("type");

    if (!name || !key || !type) {
      return {
        success: false,
        error: "Missing fields.",
      };
    }

    const cleanKey = String(key)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    if (!cleanKey) {
      return {
        success: false,
        error: "Invalid field key.",
      };
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
            name: String(name).trim(),
            namespace: "vsn_metafields",
            key: cleanKey,
            type: String(type),
            ownerType: "PRODUCT",
          },
        },
      }
    );

    const result = await mutation.json();

    if (result?.errors?.length) {
      console.error("Create GraphQL errors:", result.errors);
      return {
        success: false,
        error: result.errors[0]?.message || "Failed to create metafield.",
      };
    }

    const userErrors =
      result?.data?.metafieldDefinitionCreate?.userErrors || [];

    if (userErrors.length > 0) {
      console.error("Create user errors:", userErrors);
      return {
        success: false,
        error: userErrors[0]?.message || "Failed to create metafield.",
      };
    }

    return {
      success: true,
      message: "Metafield created successfully.",
      metafield:
        result?.data?.metafieldDefinitionCreate?.createdDefinition,
    };
  } catch (error) {
    console.error("Action failed:", error);

    return {
      success: false,
      error: error?.message || "Something went wrong.",
    };
  }
};

export default function Index() {
  const { shop } = useLoaderData();
  const statusFetcher = useFetcher();
  const actionFetcher = useFetcher();

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState("single_line_text_field");

  useEffect(() => {
    statusFetcher.load("/app/metafields-status");
  }, []);

  useEffect(() => {
    if (actionFetcher.data?.success) {
      statusFetcher.load("/app/metafields-status");
    }
  }, [actionFetcher.data]);

  const isChecking = !statusFetcher.data && statusFetcher.state !== "idle";
  const hasNotLoadedYet = !statusFetcher.data && statusFetcher.state === "idle";
  const status = statusFetcher.data;

  const typeOptions = [
    { label: "Text (Single Line)", value: "single_line_text_field" },
    { label: "Text (Multi Line)", value: "multi_line_text_field" },
    { label: "Number", value: "number_integer" },
    { label: "Date", value: "date" },
    { label: "Boolean", value: "boolean" },
    { label: "URL", value: "url" },
  ];

  const handleCreate = () => {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("key", key);
    formData.set("type", type);

    actionFetcher.submit(formData, {
      method: "post",
    });
  };

  const handleReset = () => {
    const formData = new FormData();
    formData.set("actionType", "reset_all");

    actionFetcher.submit(formData, {
      method: "post",
    });
  };

  const isLoading = actionFetcher.state !== "idle";
  const result = actionFetcher.data;

  if (hasNotLoadedYet || isChecking) {
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="info">Checking app status...</s-banner>
      </s-page>
    );
  }

  if (status && !status.ok) {
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="critical">
          {status.error || "Something went wrong."}
        </s-banner>
      </s-page>
    );
  }

  if (status && status.hasActivePlan === false) {
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="warning">
          No active plan found.{" "}
          <a href="/app/packages" target="_top">
            Click here to choose a plan
          </a>{" "}
          and get started.
        </s-banner>
      </s-page>
    );
  }

  const fields = status?.fields || [];

  return (
    <s-page heading="VSN Metafields">
      {result?.success && (
        <s-banner tone="success">{result.message}</s-banner>
      )}

      {result?.error && (
        <s-banner tone="critical">{result.error}</s-banner>
      )}

      <s-section heading="Create New Field">
        <s-stack direction="inline" gap="base">
          <s-text-field
            label="Field Name"
            name="name"
            placeholder="e.g. Inspired By"
            autoComplete="off"
            value={name}
            onInput={(e) => setName(e.target.value)}
          />

          <s-text-field
            label="Field Key"
            name="key"
            placeholder="e.g. inspired_by"
            autoComplete="off"
            value={key}
            onInput={(e) => setKey(e.target.value)}
          />

          <s-select
            label="Field Type"
            value={type}
            onInput={(e) => setType(e.target.value)}
          >
            {typeOptions.map((option) => (
              <s-option key={option.value} value={option.value}>
                {option.label}
              </s-option>
            ))}
          </s-select>

          <s-button
            variant="primary"
            loading={isLoading}
            onClick={handleCreate}
          >
            Create Field
          </s-button>
        </s-stack>
      </s-section>

      <s-section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <s-heading>Registered Fields</s-heading>

          <s-button tone="critical" loading={isLoading} onClick={handleReset}>
            Reset All Fields
          </s-button>
        </div>

        <s-section padding="none">
          <s-table padding="10">
            <s-table-header-row>
              <s-table-header>Name</s-table-header>
              <s-table-header>Key</s-table-header>
              <s-table-header>Type</s-table-header>
            </s-table-header-row>

            <s-table-body>
              {fields.map((f) => (
                <s-table-row key={f.key}>
                  <s-table-cell>{f.name}</s-table-cell>
                  <s-table-cell>{f.key}</s-table-cell>
                  <s-table-cell>{f.type}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
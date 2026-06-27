import { useLoaderData, useFetcher } from "react-router";
import { redirect } from "react-router";
import { useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  console.log("Authenticated shop:", session.shop);
  console.log("Session scope:", session.scope);

  try {
    console.log("Testing subscription query...");

    const subscriptionRes = await admin.graphql(`
      query {
        appInstallation {
          activeSubscriptions {
            id
            name
            status
          }
        }
      }
    `);

    console.log("Subscription status:", subscriptionRes.status);

    const subscriptionData = await subscriptionRes.json();
    console.log("Subscription data:", JSON.stringify(subscriptionData, null, 2));
  } catch (error) {
    console.error("Subscription query failed:", error);
    return {
      fields: [],
      noActivePlan: true,
      error: "Subscription query failed",
    };
  }

  try {
    console.log("Testing metafieldDefinitions query...");

    const res = await admin.graphql(`
      query {
        metafieldDefinitions(first: 100, ownerType: PRODUCT) {
          nodes {
            id
            name
            key
            type {
              name
            }
            namespace
          }
        }
      }
    `);

    console.log("Metafield definitions status:", res.status);

    const data = await res.json();
    console.log("Metafield definitions data:", JSON.stringify(data, null, 2));

    const definitions = data?.data?.metafieldDefinitions?.nodes || [];

    const fields = definitions
      .filter((f) => f.namespace === "vsn_metafields")
      .map((f) => ({
        name: f.name,
        key: f.key,
        type: f.type?.name,
      }));

    return { fields, noActivePlan: false };
  } catch (error) {
    console.error("Metafield definitions query failed:", error);
    return {
      fields: [],
      noActivePlan: false,
      error: "Metafield definitions query failed",
    };
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const actionType = formData.get("actionType");

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
    const definitions = data?.data?.metafieldDefinitions?.nodes || [];

    const toDelete = definitions.filter(
      (field) => field.namespace === "vsn_metafields"
    );

    for (const field of toDelete) {
      await admin.graphql(
        `#graphql
        mutation DeleteMetafieldDefinition($id: ID!) {
          metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: false) {
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
    }

    return {
      success: true,
      message: `${toDelete.length} metafield definition(s) deleted.`,
    };
  }

  const name = formData.get("name");
  const key = formData.get("key");
  const type = formData.get("type");

  if (!name || !key || !type) {
    return { success: false, error: "Missing fields." };
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
          name,
          namespace: "vsn_metafields",
          key,
          type,
          ownerType: "PRODUCT",
        },
      },
    }
  );

  const result = await mutation.json();

  const errors =
    result?.data?.metafieldDefinitionCreate?.userErrors || [];

  if (errors.length > 0) {
    return {
      success: false,
      error: errors[0].message,
    };
  }

  return {
    success: true,
    message: "Metafield created successfully.",
    metafield:
      result?.data?.metafieldDefinitionCreate?.createdDefinition,
  };
};

export default function Index() {
  const { fields, noActivePlan, error } = useLoaderData();
  const fetcher = useFetcher();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState("single_line_text_field");

  {error && <s-banner tone="critical">{error}</s-banner>}
  
  if (noActivePlan) {
    console.log("No active plan - showing banner"); // Debug log
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="warning">
          No active plan found.{" "}
          <a href="/app/packages">Click here to choose a plan</a> and get started.
        </s-banner>
      </s-page>
    );
  }

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
    fetcher.submit(formData, { method: "post" });
  };

  const handleReset = () => {
    const formData = new FormData();
    formData.set("actionType", "reset_all");
    fetcher.submit(formData, { method: "post" });
  };

  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data;

  console.log("Plan found - showing banner"); // Debug log

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
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
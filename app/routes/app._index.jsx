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

export default function Index() {
  const { shop } = useLoaderData();
  const statusFetcher = useFetcher();
  const actionFetcher = useFetcher();

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState("single_line_text_field");

  useEffect(() => {
    if (actionFetcher.data?.success) {
      statusFetcher.load("/app/metafields-status");
    }
  }, [actionFetcher.data]);

  const isChecking = statusFetcher.state !== "idle" && !statusFetcher.data;
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

  if (isChecking) {
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
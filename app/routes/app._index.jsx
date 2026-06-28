import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  console.log("Index shop:", session.shop);
  console.log("Index scope:", session.scope);

  return {
    shop: session.shop,
  };
};

export default function Index() {
  const { shop } = useLoaderData();

  const statusFetcher = useFetcher();
  const fieldsFetcher = useFetcher();
  const actionFetcher = useFetcher();

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState("single_line_text_field");

  useEffect(() => {
    statusFetcher.load(`/app/api/status${window.location.search}`);
  }, []);

  useEffect(() => {
    if (statusFetcher.data?.hasActivePlan) {
      fieldsFetcher.load(`/app/api/fields${window.location.search}`);
    }
  }, [statusFetcher.data]);

  useEffect(() => {
    if (actionFetcher.data?.success) {
      fieldsFetcher.load(`/app/api/fields${window.location.search}`);
      setName("");
      setKey("");
      setType("single_line_text_field");
    }
  }, [actionFetcher.data]);

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
      action: "/app/api/fields",
    });
  };

  const handleReset = () => {
    actionFetcher.submit(null, {
      method: "delete",
      action: "/app/api/fields",
    });
  };

  const checkingStatus =
    !statusFetcher.data && statusFetcher.state !== "idle";

  const loadingFields =
    statusFetcher.data?.hasActivePlan &&
    !fieldsFetcher.data &&
    fieldsFetcher.state !== "idle";

  const isActionLoading = actionFetcher.state !== "idle";

  const status = statusFetcher.data;
  const fieldsData = fieldsFetcher.data;
  const actionResult = actionFetcher.data;

  if (checkingStatus || !status) {
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="info">Checking app status...</s-banner>
      </s-page>
    );
  }

  if (!status.ok) {
    return (
      <s-page heading="VSN Metafields">
        <s-banner tone="critical">
          {status.error || "Status check failed."}
        </s-banner>
      </s-page>
    );
  }

  if (!status.hasActivePlan) {
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

  const fields = fieldsData?.fields || [];

  return (
    <s-page heading="VSN Metafields">
      {actionResult?.success && (
        <s-banner tone="success">{actionResult.message}</s-banner>
      )}

      {actionResult?.error && (
        <s-banner tone="critical">{actionResult.error}</s-banner>
      )}

      {fieldsData && !fieldsData.ok && (
        <s-banner tone="critical">
          {fieldsData.error || "Failed to load fields."}
        </s-banner>
      )}

      {loadingFields && (
        <s-banner tone="info">Loading registered fields...</s-banner>
      )}

      <s-section heading="Create New Field">
        <s-stack direction="inline" gap="base">
          <s-text-field
            label="Field Name"
            name="name"
            placeholder="e.g. Inspired By"
            autoComplete="off"
            value={name}
            onInput={(event) => setName(event.target.value)}
          />

          <s-text-field
            label="Field Key"
            name="key"
            placeholder="e.g. inspired_by"
            autoComplete="off"
            value={key}
            onInput={(event) => setKey(event.target.value)}
          />

          <s-select
            label="Field Type"
            value={type}
            onInput={(event) => setType(event.target.value)}
          >
            {typeOptions.map((option) => (
              <s-option key={option.value} value={option.value}>
                {option.label}
              </s-option>
            ))}
          </s-select>

          <s-button
            variant="primary"
            loading={isActionLoading}
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

          <s-button
            tone="critical"
            loading={isActionLoading}
            onClick={handleReset}
          >
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
              {fields.map((field) => (
                <s-table-row key={field.key}>
                  <s-table-cell>{field.name}</s-table-cell>
                  <s-table-cell>{field.key}</s-table-cell>
                  <s-table-cell>{field.type}</s-table-cell>
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
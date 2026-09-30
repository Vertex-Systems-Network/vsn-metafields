import { useEffect, useState } from "react";
import { Link, useFetcher, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shop: session.shop };
};

export default function Index() {
  const statusFetcher = useFetcher();
  const fieldsFetcher = useFetcher();
  const actionFetcher = useFetcher();
  const location = useLocation();

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState("single_line_text_field");
  const [ownerType, setOwnerType] = useState("PRODUCT");

  // Load status on mount
  useEffect(() => {
    statusFetcher.load(`/app/api/status${window.location.search}`);
  }, []);

  // Load fields once we know there's an active plan
  useEffect(() => {
    if (statusFetcher.data?.hasActivePlan) {
      fieldsFetcher.load(`/app/api/fields${window.location.search}${window.location.search ? "&" : "?"}ownerType=${ownerType}`);
    }
  }, [statusFetcher.data?.hasActivePlan, ownerType]);

  // Reload fields after successful action
  useEffect(() => {
    if (actionFetcher.data?.success) {
      fieldsFetcher.load(`/app/api/fields${window.location.search}${window.location.search ? "&" : "?"}ownerType=${ownerType}`);
      setName("");
      setKey("");
      setType("single_line_text_field");
    }
  }, [actionFetcher.data?.success]);

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
    formData.set("ownerType", ownerType);
    actionFetcher.submit(formData, {
      method: "post",
      action: `/app/api/fields${window.location.search}`,
    });
  };

  const handleReset = () => {
    if (
      !window.confirm(
        `Reset all VSN ${ownerType} metafield definitions? Existing metafield values will not be deleted, but these definitions will be removed.`
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("actionType", "reset");
    formData.set("ownerType", ownerType);
    formData.set("confirm", "RESET_VSN_METAFIELDS");

    actionFetcher.submit(formData, {
      method: "post",
      action: `/app/api/fields${window.location.search}`,
    });
  };

  const isActionLoading = actionFetcher.state !== "idle";

  // ✅ Fixed loading states
  const isFetchingStatus = statusFetcher.state === "loading" || !statusFetcher.data;
  const isLoadingFields = statusFetcher.data?.hasActivePlan && fieldsFetcher.state === "loading";

  const status = statusFetcher.data;
  const fieldsData = fieldsFetcher.data;
  const actionResult = actionFetcher.data;

  // ✅ Show loader until status is fetched
  if (isFetchingStatus) {
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
          <Link to={{ pathname: "/app/packages", search: location.search }}>
            Click here to choose a plan
          </Link>{" "}
          and get started.
        </s-banner>
      </s-page>
    );
  }

  const fields = fieldsData?.ownerType === ownerType ? fieldsData.fields : [];

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
      {isLoadingFields && (
        <s-banner tone="info">Loading registered fields...</s-banner>
      )}

      <s-section heading="Create New Field">
        <s-stack direction="inline" gap="base">
          <s-select
            label="Resource"
            value={ownerType}
            onInput={(event) => setOwnerType(event.target.value)}
          >
            <s-option value="PRODUCT">Product</s-option>
            <s-option value="PRODUCTVARIANT">Product variant</s-option>
            <s-option value="COLLECTION">Collection</s-option>
          </s-select>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <s-heading>Registered Fields</s-heading>
          <s-button tone="critical" loading={isActionLoading} onClick={handleReset}>
            Reset {ownerType} Fields
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
                <s-table-row key={`${ownerType}:${field.key}`}>
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